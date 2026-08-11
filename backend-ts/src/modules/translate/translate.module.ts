import { Module } from "@nestjs/common";
import { LlmCoreModule } from "../llm-core/providers.module";
import { AuthModule } from "../auth/auth.module";
import { SettingsModule } from "../settings/settings.module";
import { TranslateController } from "./translate.controller";

@Module({
  imports: [LlmCoreModule, AuthModule, SettingsModule],
  controllers: [TranslateController],
})
export class TranslateModule {}
