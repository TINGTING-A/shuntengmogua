import { Injectable } from "@nestjs/common";
import { BaseSubAgent, type AgentCard, type AgentInput, type AgentOutput } from "../base-agent";

const enterpriseCard = (id: string, name: string, desc: string, toolNames: string[]): AgentCard => ({
  id,
  name,
  description: desc,
  category: "connector" as const,
  systemPrompt: `你是顺藤摸瓜的${name}，企业异构总线连接器。`,
  capabilities: [
    { id: "message", name: "消息收发", description: "IM消息文本/图片/文件收发" },
    { id: "approval", name: "审批流", description: "审批流创建/查询/处理" },
    { id: "calendar", name: "日程", description: "日历事件读写" },
    { id: "document", name: "文档", description: "在线文档读写" },
  ],
  tools: toolNames.map((t) => ({ name: t, description: `${t}操作` })),
  version: "0.1.0-enterprise",
});

@Injectable()
export class DingTalkAgent extends BaseSubAgent {
  readonly card = enterpriseCard(
    "dingtalk-agent", "钉钉Agent",
    "钉钉连接器：消息收发、审批流、日程、文档",
    ["send_dingtalk_message", "query_approvals", "get_calendar"],
  );
  async execute(_input: AgentInput): Promise<AgentOutput> {
    return { success: true, result: { msg: "钉钉Agent就绪，需要钉钉开放平台AppKey/AppSecret" }, summary: "钉钉Agent已就绪" };
  }
}

@Injectable()
export class FeishuAgent extends BaseSubAgent {
  readonly card = enterpriseCard(
    "feishu-agent", "飞书Agent",
    "飞书连接器：消息、文档、多维表格、审批",
    ["send_feishu_message", "read_doc", "query_bitable"],
  );
  async execute(_input: AgentInput): Promise<AgentOutput> {
    return { success: true, result: { msg: "飞书Agent就绪，需要飞书开放平台App ID/App Secret" }, summary: "飞书Agent已就绪" };
  }
}

@Injectable()
export class WecomAgent extends BaseSubAgent {
  readonly card = enterpriseCard(
    "wecom-agent", "企业微信Agent",
    "企业微信连接器：消息、客户联系、审批",
    ["send_wecom_message", "get_customer", "create_approval"],
  );
  async execute(_input: AgentInput): Promise<AgentOutput> {
    return { success: true, result: { msg: "企微Agent就绪，需要企业微信CorpID/Secret" }, summary: "企微Agent已就绪" };
  }
}

@Injectable()
export class WpsAgent extends BaseSubAgent {
  readonly card = enterpriseCard(
    "wps-agent", "WPS Agent",
    "WPS连接器：文档读写、表格操作",
    ["read_wps_doc", "write_wps_doc", "query_wps_table"],
  );
  async execute(_input: AgentInput): Promise<AgentOutput> {
    return { success: true, result: { msg: "WPS Agent就绪，需要WPS开放平台AppKey" }, summary: "WPS Agent已就绪" };
  }
}
