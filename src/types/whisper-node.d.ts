declare module "whisper-node" {
  interface WhisperOptions {
    outputInText?: boolean;
    language?: string;
    wordTimestamps?: boolean;
    [key: string]: any;
  }

  interface WhisperConfig {
    modelName?: string;
    modelPath?: string;
    whisperOptions?: WhisperOptions;
  }

  interface WhisperResult {
    speech: string;
    start?: string;
    end?: string;
  }

  export function whisper(
    filePath: string,
    config?: WhisperConfig
  ): Promise<WhisperResult[]>;
}