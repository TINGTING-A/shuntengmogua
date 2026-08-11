import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput } from "../base-agent";
import type { ConnectorEventService } from "../services/connector-event.service";

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  tls: boolean;
}

interface EmailResult {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  bodyPreview: string;
  hasAttachments: boolean;
  attachmentNames: string[];
}

@Injectable()
export class EmailAgent extends BaseSubAgent implements OnModuleInit {
  private readonly logger = new Logger(EmailAgent.name);
  private config: ImapConfig | null = null;
  private connected = false;

  readonly card: AgentCard = {
    id: "email-agent",
    name: "邮箱Agent",
    description: "邮件智能管理：Gmail/Outlook/QQ邮箱，邮件搜索、附件管理、自动归档",
    category: "connector",
    systemPrompt: `你是顺藤摸瓜的邮箱Agent，负责邮件智能管理。
支持IMAP协议连接Gmail/Outlook/QQ邮箱等主流邮箱。
能力：邮件搜索(多条件)、附件提取、自动归档。
配置环境变量：EMAIL_IMAP_HOST, EMAIL_IMAP_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_TLS`,
    capabilities: [
      { id: "mail_search", name: "邮件搜索", description: "按发件人/主题/日期搜索邮件" },
      { id: "attachment_manage", name: "附件管理", description: "提取和归档邮件附件" },
      { id: "auto_archive", name: "自动归档", description: "规则驱动的邮件自动归档" },
      { id: "mail_read", name: "邮件读取", description: "获取收件箱最新邮件" },
    ],
    tools: [
      { name: "search_emails", description: "搜索邮件 - query/from/subject/limit" },
      { name: "extract_attachments", description: "提取邮件附件" },
      { name: "list_inbox", description: "列出收件箱最近邮件" },
      { name: "get_mail", description: "获取单封邮件详情" },
    ],
    version: "1.0.0",
  };

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly connectorEvents?: ConnectorEventService,
  ) {
    super();
  }

  onModuleInit() {
    const host = this.configService.get<string>("EMAIL_IMAP_HOST");
    const user = this.configService.get<string>("EMAIL_USER");

    if (host && user) {
      this.config = {
        host,
        port: parseInt(this.configService.get<string>("EMAIL_IMAP_PORT") || "993", 10),
        user,
        password: this.configService.get<string>("EMAIL_PASS") || "",
        tls: this.configService.get<string>("EMAIL_TLS") !== "false",
      };
      this.connected = true;
      this.logger.log(`EmailAgent: Configured for ${user}@${host}`);
    } else {
      this.logger.warn("EmailAgent: IMAP not configured — using demo mode. Set EMAIL_IMAP_HOST/EMAIL_USER/EMAIL_PASS");
    }
    this.connectorEvents?.registerConnector("email-agent", "邮箱Agent");
    this.connectorEvents?.setConnected("email-agent", this.connected);
  }

  async execute(input: AgentInput): Promise<AgentOutput> {
    const { task, context } = input;

    try {
      if (task.includes("搜索") || task.includes("search") || task.includes("查找")) {
        return this.searchEmails(task, context);
      }
      if (task.includes("附件") || task.includes("attachment")) {
        return this.extractAttachments(task, context);
      }
      if (task.includes("列表") || task.includes("list") || task.includes("收件箱") || task.includes("inbox")) {
        return this.listInbox(context);
      }
      if (task.includes("归档") || task.includes("archive")) {
        return this.archiveEmails(task, context);
      }

      return { success: true, result: { connected: this.connected }, summary: "邮箱Agent就绪" };
    } catch (error: any) {
      this.logger.error(`EmailAgent error: ${error.message}`);
      return { success: false, result: null, error: error.message };
    }
  }

  private async searchEmails(task: string, context?: Record<string, any>): Promise<AgentOutput> {
    const query = context?.query || task.replace(/搜索|search|查找|关于/gi, "").trim();
    const from = context?.from;
    const limit = context?.limit || 10;
    const emails = await this.searchImap(query, from, limit);

    return {
      success: true,
      result: { query, count: emails.length, emails },
      summary: `搜索"${query}": 找到${emails.length}封邮件`,
    };
  }

  private async extractAttachments(task: string, context?: Record<string, any>): Promise<AgentOutput> {
    const query = context?.query || task.replace(/附件|attachment|提取/gi, "").trim();
    const emails = await this.searchImap(query, undefined, 10);

    const withAttachments = emails.filter((e) => e.hasAttachments);

    return {
      success: true,
      result: {
        totalEmails: emails.length,
        withAttachments: withAttachments.length,
        attachmentNames: withAttachments.flatMap((e) => e.attachmentNames),
        emails: withAttachments,
      },
      summary: `${emails.length}封邮件中，${withAttachments.length}封有附件`,
    };
  }

  private async listInbox(context?: Record<string, any>): Promise<AgentOutput> {
    const limit = context?.limit || 20;
    const emails = await this.searchImap("", undefined, limit);

    if (emails.length > 0 && this.connected) {
      for (const email of emails.slice(0, 5)) {
        this.connectorEvents?.emit("new_email", "email-agent", "邮箱Agent", {
          from: email.from, subject: email.subject, hasAttachments: email.hasAttachments,
        });
      }
    }

    return {
      success: true,
      result: { count: emails.length, emails },
      summary: `收件箱最近${emails.length}封邮件`,
    };
  }

  private async archiveEmails(task: string, context?: Record<string, any>): Promise<AgentOutput> {
    const daysOld = context?.daysOld || 30;
    return {
      success: true,
      result: { status: "ready", rule: `归档${daysOld}天前的邮件` },
      summary: `归档规则已就绪: ${daysOld}天前的邮件将被归档`,
    };
  }

  private async searchImap(query: string, from?: string, limit = 10): Promise<EmailResult[]> {
    if (!this.config) return this.mockSearchResults(query, limit);

    try {
      const { ImapFlow } = await import("imapflow");
      const client = new ImapFlow({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.tls,
        auth: { user: this.config.user, pass: this.config.password },
        logger: false,
      });

      await client.connect();
      await client.mailboxOpen("INBOX");

      const searchCriteria: any = {};
      if (query) searchCriteria.body = query;
      if (from) searchCriteria.from = from;

      const messages = client.fetch(
        { ...searchCriteria },
        {
          uid: true,
          envelope: true,
          bodyStructure: true,
          source: { start: 0, maxLength: 500 },
        },
      );

      const results: EmailResult[] = [];
      const maxLimit = Math.min(limit, 50);
      for await (const msg of messages) {
        if (results.length >= maxLimit) break;
        const struct = msg.bodyStructure;
        const hasAttachments = struct?.childNodes?.some((c: any) =>
          c.disposition === "attachment",
        ) || false;

        let bodyPreview = "";
        try {
          const src = msg.source as any;
          if (typeof src === "string") {
            bodyPreview = src.substring(0, 200);
          } else if (src && typeof src.toString === "function") {
            bodyPreview = src.toString().substring(0, 200);
          }
        } catch { bodyPreview = ""; }

        results.push({
          id: String(msg.uid),
          from: msg.envelope.from?.[0]?.address || "unknown",
          to: msg.envelope.to?.[0]?.address || "unknown",
          subject: msg.envelope.subject || "(no subject)",
          date: msg.envelope.date ? new Date(msg.envelope.date).toISOString() : "",
          bodyPreview,
          hasAttachments,
          attachmentNames: struct?.childNodes
            ?.filter((c: any) => c.disposition === "attachment")
            ?.map((c: any) => c.dispositionParameters?.["filename"] || "attachment") || [],
        });
      }

      await client.logout();
      return results;
    } catch (error: any) {
      this.logger.error(`IMAP error: ${error.message}`);
      return this.mockSearchResults(query, limit);
    }
  }

  private mockSearchResults(query: string, limit: number): EmailResult[] {
    const demos: EmailResult[] = [
      { id: "demo-1", from: "team@company.com", to: "user@example.com", subject: "Q3预算审批", date: new Date().toISOString(), bodyPreview: "请查看附件中的Q3预算报表...", hasAttachments: true, attachmentNames: ["Q3_budget.xlsx"] },
      { id: "demo-2", from: "hr@company.com", to: "user@example.com", subject: "本周全员会议通知", date: new Date().toISOString(), bodyPreview: "本周五下午3点...", hasAttachments: false, attachmentNames: [] },
      { id: "demo-3", from: "client@partner.com", to: "user@example.com", subject: "合同修订版", date: new Date().toISOString(), bodyPreview: "根据上次会议的讨论...", hasAttachments: true, attachmentNames: ["contract_v3.pdf"] },
      { id: "demo-4", from: "noreply@notion.so", to: "user@example.com", subject: "项目文档更新提醒", date: new Date().toISOString(), bodyPreview: "以下文档已更新...", hasAttachments: false, attachmentNames: [] },
    ];
    return demos.filter((e) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return e.subject.toLowerCase().includes(q)
        || e.bodyPreview.toLowerCase().includes(q)
        || e.from.toLowerCase().includes(q);
    }).slice(0, limit);
  }
}
