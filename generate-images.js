require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");

const API_KEY = process.env.GEMINI_API_KEY;
const IMAGES_DIR = path.join(__dirname, "images");

const articles = [
  {
    file: "alien-mayor.jpg",
    prompt: "Grainy black and white tabloid newspaper photograph of a tall grey alien in an ill-fitting business suit standing behind a podium at a city hall press conference, shaking hands with confused city officials, American flags in the background, flash photography, harsh shadows, 1990s tabloid newspaper photo quality, photojournalistic style, no dark areas at top"
  },
  {
    file: "time-traveler.jpg",
    prompt: "Grainy black and white tabloid newspaper photograph of a bewildered man in futuristic silver clothing standing in the middle of a busy 1990s shopping mall food court, holding a strange glowing device, shoppers staring at him, security guards approaching, harsh flash photography, vintage tabloid newspaper photo style, no dark areas at top"
  },
  {
    file: "bigfoot-irs.jpg",
    prompt: "Grainy black and white tabloid newspaper photograph of a large sasquatch bigfoot creature sitting at a desk in a government office cubicle, wearing reading glasses and a tie, surrounded by stacks of paper and filing cabinets, looking stressed, harsh fluorescent office lighting, tabloid newspaper photo quality, no dark areas at top"
  },
  {
    file: "moon-cheese.jpg",
    prompt: "Grainy black and white tabloid newspaper photograph of NASA scientists in white lab coats in a laboratory examining what appears to be a giant wheel of swiss cheese on a metal table, one scientist is tasting a piece while others take notes, bright laboratory lighting, vintage tabloid newspaper photo quality, no dark areas at top"
  },
  {
    file: "robot-therapist.jpg",
    prompt: "Grainy black and white tabloid newspaper photograph of a humanoid robot sitting in a therapist chair across from a human patient lying on a couch, the robot is taking notes on a clipboard, modern office setting, lamp lighting, vintage tabloid newspaper photo quality, no dark areas at top"
  },
  {
    file: "ghost-congress.jpg",
    prompt: "Grainy black and white tabloid newspaper photograph of a translucent ghostly figure floating above the seats in the United States Congress chamber, members of congress looking up in shock, dramatic lighting with lens flare, vintage tabloid newspaper photo quality, no dark areas at top"
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
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log(`\nDone. Generated: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
