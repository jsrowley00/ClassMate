import { clerkMiddleware, getAuth, clerkClient } from "@clerk/express";
import type { Express, RequestHandler } from "express";
import { storage } from "./storage";

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  app.use(clerkMiddleware());
  
  // Handle legacy logout route - redirect to landing page
  app.get("/api/logout", (_req, res) => {
    res.redirect("/");
  });
  
  // Also handle POST for logout
  app.post("/api/logout", (_req, res) => {
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
    
    const userEmail = clerkUser.emailAddresses[0]?.emailAddress || "";
    
    await storage.upsertUser({
      id: auth.userId,
      email: userEmail,
      firstName: clerkUser.firstName || "",
      lastName: clerkUser.lastName || "",
      profileImageUrl: clerkUser.imageUrl || "",
    });

    // Auto-enroll user in courses they were invited to before creating their account
    if (userEmail) {
      try {
        await storage.processPendingInvitations(auth.userId, userEmail);
      } catch (error) {
        console.error("Error processing pending invitations:", error);
      }
    }

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
