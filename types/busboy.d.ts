declare module "busboy" {
  import type { Writable } from "node:stream";

  interface BusboyConfig {
    headers: { "content-type": string };
    limits?: { files?: number; fileSize?: number };
  }

  interface FileInfo {
    filename: string;
    encoding: string;
    mimeType: string;
  }

  interface BusboyInstance extends Writable {
    on(
      event: "file",
      listener: (
        name: string,
        stream: NodeJS.ReadableStream,
        info: FileInfo
      ) => void
    ): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "finish", listener: () => void): this;
  }

  function busboy(config: BusboyConfig): BusboyInstance;
  export default busboy;
}
