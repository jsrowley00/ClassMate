import { Client } from "@replit/object-storage";
import { randomUUID } from "crypto";
import { Response } from "express";

let client: Client | null = null;
let isAvailable: boolean | null = null;

async function getClient(): Promise<Client | null> {
  if (client !== null) return client;
  
  try {
    const newClient = new Client();
    // Test if the client is properly configured by trying to list objects
    const result = await newClient.list({ prefix: "__test__" });
    if (result.ok) {
      client = newClient;
      isAvailable = true;
      console.log("Object Storage is available and configured");
      return client;
    } else {
      console.log("Object Storage is not configured:", result.error);
      isAvailable = false;
      return null;
    }
  } catch (error) {
    console.log("Object Storage initialization failed:", error);
    isAvailable = false;
    return null;
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  async isAvailable(): Promise<boolean> {
    if (isAvailable !== null) return isAvailable;
    const c = await getClient();
    return c !== null;
  }

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
    const c = await getClient();
    if (!c) {
      throw new Error("Object Storage is not available. Please create a bucket in App Storage.");
    }
    
    const result = await c.uploadFromBytes(storageKey, buffer);
    
    if (!result.ok) {
      throw new Error(`Failed to upload: ${result.error}`);
    }

    return {
      storageKey,
      sizeBytes: buffer.length,
    };
  }

  async downloadToBuffer(storageKey: string): Promise<Buffer> {
    const c = await getClient();
    if (!c) {
      throw new Error("Object Storage is not available");
    }
    
    const result = await c.downloadAsBytes(storageKey);
    
    if (!result.ok) {
      throw new ObjectNotFoundError();
    }

    return result.value[0];
  }

  async streamToResponse(storageKey: string, res: Response, contentType?: string): Promise<void> {
    const c = await getClient();
    if (!c) {
      throw new Error("Object Storage is not available");
    }
    
    const stream = c.downloadAsStream(storageKey);
    
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
    const c = await getClient();
    if (!c) return;
    
    const result = await c.delete(storageKey, { ignoreNotFound: true });
    if (!result.ok) {
      console.error(`Failed to delete object ${storageKey}:`, result.error);
    }
  }

  async objectExists(storageKey: string): Promise<boolean> {
    const c = await getClient();
    if (!c) return false;
    
    const result = await c.exists(storageKey);
    if (!result.ok) {
      return false;
    }
    return result.value;
  }

  async listObjects(prefix?: string): Promise<string[]> {
    const c = await getClient();
    if (!c) {
      throw new Error("Object Storage is not available");
    }
    
    const result = await c.list(prefix ? { prefix } : undefined);
    if (!result.ok) {
      throw new Error(`Failed to list objects: ${result.error}`);
    }
    return result.value.map(obj => obj.name);
  }
}

export const objectStorageService = new ObjectStorageService();
