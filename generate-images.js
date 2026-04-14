require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY;
const IMAGES_DIR = path.join(__dirname, "images");

const articles = [
  {
    file: "senate-filibuster.jpg",
    prompt: "Professional editorial news photograph inside the U.S. Senate chamber, senators at their desks surrounded by hot dogs and competitive eating equipment, chaotic scene with suited politicians eating frantically, photojournalistic style, bright interior lighting from overhead chandeliers, well-lit, no dark areas at top of image, newspaper front page photography, high resolution, realistic"
  },
  {
    file: "iphone-mirror.jpg",
    prompt: "Minimalist product photograph of a sleek modern smartphone standing upright on a white pedestal that is literally just a mirror showing a reflection, Apple keynote presentation style, dramatic studio lighting from above, bright white background, no dark areas at top of image, clean product photography, high resolution"
  },
  {
    file: "influencer-hospital.jpg",
    prompt: "Editorial news photograph of a bewildered young woman in a hospital gown sitting on a hospital bed looking confused at an old flip phone, medical monitors in background, photojournalistic documentary style, bright fluorescent hospital lighting, no dark areas at top of image, newspaper photography, realistic"
  },
  {
    file: "scientists-streaming.jpg",
    prompt: "Professional photograph of three frustrated researchers in white lab coats gathered around computer monitors displaying streaming service browsing interfaces with rows of movie thumbnails, modern research laboratory setting, bright overhead fluorescent lighting, no dark areas at top of image, editorial news photography, realistic"
  },
  {
    file: "switzerland-diplomat.jpg",
    prompt: "News photograph of a panicked middle-aged diplomat in a suit at a wooden press conference podium with microphones, Swiss flags with white cross on red background behind him, hands raised in defensive gesture, press conference setting, bright stage lighting from above, no dark areas at top of image, photojournalistic style, realistic"
  },
  {
    file: "soccer-parents.jpg",
    prompt: "Sports photograph of an empty youth soccer field sideline with folding chairs knocked over, a referee whistle abandoned on the grass, and cardboard cutout figures of angry parents placed in the small metal bleachers, bright daylight, overcast bright sky, no harsh shadows, sports photojournalism, realistic, no dark areas at top"
  }
];

async function generateImage(ai, article, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`Generating: ${article.file} (attempt ${attempt + 1})...`);

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: article.prompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      });

      if (response.candidates && response.candidates[0]) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            const outputPath = path.join(IMAGES_DIR, article.file);
            fs.writeFileSync(outputPath, Buffer.from(part.inlineData.data, "base64"));
            console.log(`  Saved: ${outputPath}`);
            return true;
          }
        }
      }

      console.log(`  No image data in response, retrying...`);
    } catch (err) {
      console.error(`  Error: ${err.message}`);
      if (attempt < retries) {
        console.log(`  Retrying in 3s...`);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }
  return false;
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  let success = 0;
  let failed = 0;

  for (const article of articles) {
    const result = await generateImage(ai, article);
    if (result) {
      success++;
    } else {
      failed++;
      console.error(`  FAILED: ${article.file}`);
    }
    // Small delay between generations
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\nDone. Generated: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
