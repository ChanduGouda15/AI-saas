import OpenAI from "openai";
import sql from "../configs/db.js";
import { clerkClient } from "@clerk/express";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import fs from 'fs'
import pdf from 'pdf-parse/lib/pdf-parse.js'

const AI = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

export const generateArticle = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const { prompt, length } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if(plan !== 'premium' && free_usage >= 10){
            return res.json({ success: false, message: "Limit reached. Upgrade to continue."})
        }

        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.7,
            max_tokens: length,
        });

        const content = response.choices[0].message.content

        await sql` INSERT INTO creations (user_id, prompt, content, type) 
        VALUES (${userId}, ${prompt}, ${content}, 'article')`;

        if(plan !== 'premium'){
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata:{
                    free_usage: free_usage + 1
                }
            })
        }

        res.json({ success: true, content})


    } catch (error) {
        console.log(error.message)
        res.json({success: false, message: error.message})
    }
}

export const generateBlogTitle = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const { prompt } = req.body;
        const plan = req.plan;
        const free_usage = req.free_usage;

        if(plan !== 'premium' && free_usage >= 10){
            return res.json({ success: false, message: "Limit reached. Upgrade to continue."})
        }

        const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: prompt, } ],
            temperature: 0.7,
            max_tokens: 100,
        });

        const content = response.choices[0].message.content

        await sql` INSERT INTO creations (user_id, prompt, content, type) 
        VALUES (${userId}, ${prompt}, ${content}, 'blog-title')`;

        if(plan !== 'premium'){
            await clerkClient.users.updateUserMetadata(userId, {
                privateMetadata:{
                    free_usage: free_usage + 1
                }
            })
        }

        res.json({ success: true, content})


    } catch (error) {
        console.log(error.message)
        res.json({success: false, message: error.message})
    }
}


export const generateImage = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const { prompt, publish } = req.body;
        const plan = req.plan;

        if(plan !== 'premium'){
            return res.json({ success: false, message: "This feature is only available for premium subscriptions"})
        }

        console.log('=== Starting image generation ===');
        console.log('Prompt:', prompt);
        console.log('API Key present:', !!process.env.HUGGINGFACE_API_KEY);
        console.log('API Key starts with hf_:', process.env.HUGGINGFACE_API_KEY?.startsWith('hf_'));

        // Using Stable Diffusion 2.1 (faster and more reliable)
        const response = await axios.post(
            'https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1',
            { 
                inputs: prompt,
                options: {
                    wait_for_model: true,
                    use_cache: false
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                responseType: 'arraybuffer',
                timeout: 90000,
                validateStatus: function (status) {
                    return status < 600; // Don't throw on any status
                }
            }
        );

        console.log('Response status:', response.status);
        console.log('Response content-type:', response.headers['content-type']);

        // Check for errors
        if (response.status === 401) {
            console.error('Authentication failed - check your API key');
            return res.json({
                success: false, 
                message: "Invalid Hugging Face API key. Please verify your token."
            });
        }

        if (response.status === 403) {
            console.error('Access forbidden - check token permissions');
            return res.json({
                success: false, 
                message: "API key doesn't have required permissions. Enable 'Make calls to Inference Providers'."
            });
        }

        if (response.status === 503) {
            console.log('Model is loading...');
            return res.json({
                success: false, 
                message: "AI model is warming up. Please wait 15 seconds and click Generate again."
            });
        }

        if (response.status !== 200) {
            console.error('Unexpected status:', response.status);
            const errorText = Buffer.from(response.data).toString('utf8');
            console.error('Error response:', errorText);
            return res.json({
                success: false, 
                message: `API returned status ${response.status}. Please try again.`
            });
        }

        // Check if we got actual image data
        if (!response.data || response.data.byteLength === 0) {
            console.error('Empty response data');
            return res.json({
                success: false, 
                message: "Received empty response. Model might be loading, try again."
            });
        }

        console.log('Image data size:', response.data.byteLength, 'bytes');

        // Convert to base64
        const base64Image = `data:image/png;base64,${Buffer.from(response.data, 'binary').toString('base64')}`;
        console.log('Base64 image created, length:', base64Image.length);

        // Upload to Cloudinary
        console.log('Uploading to Cloudinary...');
        const {secure_url} = await cloudinary.uploader.upload(base64Image);
        console.log('Cloudinary URL:', secure_url);

        // Save to database
        await sql` INSERT INTO creations (user_id, prompt, content, type, publish) 
        VALUES (${userId}, ${prompt}, ${secure_url}, 'image', ${publish ?? false })`;

        console.log('=== Image generation successful! ===');

        res.json({ 
            success: true, 
            content: secure_url
        })

    } catch (error) {
        console.error('=== Image generation error ===');
        console.error('Error type:', error.constructor.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response statusText:', error.response.statusText);
            try {
                const errorText = Buffer.from(error.response.data).toString('utf8');
                console.error('Response data:', errorText);
            } catch (e) {
                console.error('Could not parse error response');
            }
        }
        
        if (error.code === 'ECONNABORTED') {
            return res.json({
                success: false, 
                message: "Request timeout. Model is loading. Wait 20 seconds and try again."
            });
        }

        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            return res.json({
                success: false, 
                message: "Cannot reach Hugging Face API. Check your internet connection."
            });
        }
        
        res.json({
            success: false, 
            message: `Generation failed: ${error.message}`
        });
    }
}



export const removeImageBackground = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const image = req.file;
        const plan = req.plan;

        if(plan !== 'premium'){
            return res.json({ success: false, message: "This feature is only available for premium subscriptions"})
        }

        const {secure_url} = await cloudinary.uploader.upload(image.path, {
            transformation: [
                {
                    effect: 'background_removal',
                    background_removal: 'remove_the_background'
                }
            ]
        })

        await sql` INSERT INTO creations (user_id, prompt, content, type) 
        VALUES (${userId}, 'Remove background from image', ${secure_url}, 'image')`;

        res.json({ success: true, content: secure_url})

    } catch (error) {
        console.log(error.message)
        res.json({success: false, message: error.message})
    }
}

export const removeImageObject = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const { object } = req.body;
        const image = req.file;
        const plan = req.plan;

        if(plan !== 'premium'){
            return res.json({ success: false, message: "This feature is only available for premium subscriptions"})
        }

        const {public_id} = await cloudinary.uploader.upload(image.path)

        const imageUrl = cloudinary.url(public_id, {
            transformation: [{effect: `gen_remove:${object}`}],
            resource_type: 'image'
        })

        await sql` INSERT INTO creations (user_id, prompt, content, type) 
        VALUES (${userId}, ${`Removed ${object} from image`}, ${imageUrl}, 'image')`;

        res.json({ success: true, content: imageUrl})

    } catch (error) {
        console.log(error.message)
        res.json({success: false, message: error.message})
    }
}

export const resumeReview = async (req, res)=>{
    try {
        const { userId } = req.auth();
        const resume = req.file;
        const plan = req.plan;

        if(plan !== 'premium'){
            return res.json({ success: false, message: "This feature is only available for premium subscriptions"})
        }

        if(resume.size > 5 * 1024 * 1024){
            return res.json({success: false, message: "Resume file size exceeds allowed size (5MB)."})
        }

        const dataBuffer = fs.readFileSync(resume.path)
        const pdfData = await pdf(dataBuffer)

        const prompt = `Review the following resume and provide constructive feedback on its strengths, weaknesses, and areas for improvement. Resume Content:\n\n${pdfData.text}`

       const response = await AI.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: prompt, } ],
            temperature: 0.7,
            max_tokens: 1000,
        });

        const content = response.choices[0].message.content

        await sql` INSERT INTO creations (user_id, prompt, content, type) 
        VALUES (${userId}, 'Review the uploaded resume', ${content}, 'resume-review')`;

        res.json({ success: true, content})

    } catch (error) {
        console.log(error.message)
        res.json({success: false, message: error.message})
    }
}