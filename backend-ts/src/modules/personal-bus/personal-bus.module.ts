import { Module, Logger, OnModuleInit } from "@nestjs/common";
import { CrdtSyncService } from "./services/crdt-sync.service";
import { E2EEService } from "./services/e2ee.service";
import { LocalEmbeddingService } from "./services/local-embedding.service";

@Module({
  providers: [
    CrdtSyncService,
    E2EEService,
    LocalEmbeddingService,
  ],
  exports: [
    CrdtSyncService,
    E2EEService,
    LocalEmbeddingService,
  ],
})
export class PersonalBusModule implements OnModuleInit {
  private readonly logger = new Logger(PersonalBusModule.name);

  onModuleInit() {
    this.logger.log("PersonalBusModule initialized: CRDT + E2EE + BGE-M3 Embedding ready");
  }
}
