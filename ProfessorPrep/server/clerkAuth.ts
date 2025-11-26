import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  app.use(clerkMiddleware());
  
  // Handle legacy logout route - redirect to home page
  app.get("/api/logout", (_req, res) => {
    res.redirect("/");
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  try {
    const auth = getAuth(req);
    
    if (!auth.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const clerkUser = await clerkClient.users.getUser(auth.userId);
    
    await storage.upsertUser({
      id: auth.userId,
      email: clerkUser.emailAddresses[0]?.emailAddress || "",
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      profileImageUrl: clerkUser.imageUrl || "",
    });

    (req as any).user = {
      claims: {
        sub: auth.userId,
        email: clerkUser.emailAddresses[0]?.emailAddress,
        first_name: clerkUser.firstName,
        last_name: clerkUser.lastName,
        profile_image_url: clerkUser.imageUrl,
      }
    };

    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
};
