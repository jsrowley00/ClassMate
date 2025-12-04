import { Client } from "@replit/object-storage";
import { randomUUID } from "crypto";
import { Response } from "express";

const client = new Client();

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  generateStorageKey(courseId: string, filename: string): string {
    const uuid = randomUUID();
    const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `courses/${courseId}/${uuid}-${safeFilename}`;
  }

  async uploadBuffer(
    buffer: Buffer,
    storageKey: string,
    _contentType: string
  ): Promise<{ storageKey: string; sizeBytes: number }> {
    const result = await client.uploadFromBytes(storageKey, buffer);
    
    if (!result.ok) {
      throw new Error(`Failed to upload: ${result.error}`);
    }

    return {
      storageKey,
      sizeBytes: buffer.length,
    };
  }

  async downloadToBuffer(storageKey: string): Promise<Buffer> {
    const result = await client.downloadAsBytes(storageKey);
    
    if (!result.ok) {
      throw new ObjectNotFoundError();
    }

    return result.value[0];
  }

  async streamToResponse(storageKey: string, res: Response, contentType?: string): Promise<void> {
    const stream = client.downloadAsStream(storageKey);
    
    if (contentType) {
      res.set("Content-Type", contentType);
    }
    res.set("Cache-Control", "private, max-age=3600");
    
    stream.on("error", (err: Error) => {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming file" });
      }
    });

    stream.pipe(res);
  }

  async deleteObject(storageKey: string): Promise<void> {
    const result = await client.delete(storageKey, { ignoreNotFound: true });
    if (!result.ok) {
      console.error(`Failed to delete object ${storageKey}:`, result.error);
    }
  }

  async objectExists(storageKey: string): Promise<boolean> {
    const result = await client.exists(storageKey);
    if (!result.ok) {
      return false;
    }
    return result.value;
  }

  async listObjects(prefix?: string): Promise<string[]> {
    const result = await client.list(prefix ? { prefix } : undefined);
    if (!result.ok) {
      throw new Error(`Failed to list objects: ${result.error}`);
    }
    return result.value.map(obj => obj.name);
  }
}

export const objectStorageService = new ObjectStorageService();
