import { Module } from "@nestjs/common";
import { BrowserProxyController } from "./browser-proxy.controller";

@Module({
  controllers: [BrowserProxyController],
})
export class BrowserProxyModule {}
