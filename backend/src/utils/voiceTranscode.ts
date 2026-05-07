import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { logger } from './logger';

/** WhatsApp Cloud API requires Opus in OGG for voice links it fetches from our URL. */
export async function transcodeWebmToWhatsAppOgg(inputPath: string, outputPath: string): Promise<void> {
  await fs.promises.unlink(outputPath).catch(() => {});
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libopus')
      .audioBitrate(64)
      .format('ogg')
      .on('end', () => resolve())
      .on('error', (err: Error, _stdout: string, stderr: string) => {
        logger.error(`ffmpeg voice transcode: ${err.message}`, { stderr: stderr?.slice?.(0, 500) });
        reject(err);
      })
      .save(outputPath);
  });
}

export function whatsAppVoiceOutputPath(uploadDir: string, multerSavedPath: string): string {
  const base = path.basename(multerSavedPath, path.extname(multerSavedPath));
  return path.join(uploadDir, `${base}_wa.ogg`);
}
