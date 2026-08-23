// src/types/node-wav.d.ts
declare module "node-wav" {
  interface WavDecodeResult {
    sampleRate: number;
    channelData: Float32Array[];
  }
  function decode(buffer: Buffer): WavDecodeResult;
  function encode(channelData: Float32Array[], opts: { sampleRate: number; float?: boolean; bitDepth?: number }): Buffer;
  export = { decode, encode };
}