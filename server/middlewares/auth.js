import { clerkClient } from "@clerk/express";

// Middleware to check userId and check premium plan from PUBLIC METADATA

export const auth = async (req, res, next)=>{
    try {
        const {userId} = await req.auth();

        // Get user from Clerk to access metadata
        const user = await clerkClient.users.getUser(userId);

        // Check premium plan from PUBLIC METADATA (not authorization roles)
        const isPremium = user.publicMetadata?.plan === 'premium';

        if(!isPremium && user.privateMetadata?.free_usage){
            req.free_usage = user.privateMetadata.free_usage
        } else if (!isPremium) {
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata: {
                    free_usage: 0
                }
            })
            req.free_usage = 0;
        } else {
            req.free_usage = 0; // Premium users don't have usage limits
        }

        req.plan = isPremium ? 'premium' : 'free';
        next()
    } catch (error) {
        res.json({ success: false, message: error.message })
    }
}