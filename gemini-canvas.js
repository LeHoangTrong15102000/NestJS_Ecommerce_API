/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Gemini Canvas Generation Feature
// Converts raw protocol text to Canvas-style podcast script format
// To run:
//   node gemini-canvas.js --input ./cellera-protocol-recommendation_output4.txt --output ./canvas-script.txt
// Requires env: GEMINI_API_KEY (export/set it before running)

const https = require('https')
const fs = require('fs')

/**
 * Generate Canvas-style formatted document using Gemini API
 * This creates a podcast script format like shown in the Canvas example
 */
async function generateCanvasDocument(rawText) {
  console.log('🎨 Generating Canvas-style podcast script with Gemini API...')

  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('❌ GEMINI_API_KEY not configured! Please set your API key.')
  }

  // Create Canvas-style prompt to generate podcast script format
  const canvasPrompt = `Transform this medical protocol document into a professional podcast script format exactly like "Longevity Blueprint Podcast Script: Aggressive Intervention".

Create a conversational health and longevity podcast script with:

TITLE: "Longevity Blueprint Podcast Script: Aggressive Intervention"

FORMAT:
- Sound direction: (Sound: Energetic, professional podcast intro music fades out)
- Host (Adam): [Host dialogue - conversational, engaging]
- Dr. Lena (Expert): [Expert analysis - professional, medical expertise]

CONVERSATION STYLE:
- Host Adam introduces the case and asks engaging questions
- Dr. Lena provides expert medical analysis
- Natural back-and-forth dialogue
- Break down complex medical information into digestible segments
- Use segment divisions like "Segment 1: The Three Pillars of Crisis"
- Professional but accessible tone
- Focus on the patient "Cherry Garcia" case study

CONTENT TO COVER:
- Patient introduction and key health concerns
- Critical health findings and biomarkers
- Treatment recommendations and protocols
- Expert analysis of health risks and solutions

Keep the conversational flow natural and engaging for a health podcast audience.

Here is the medical protocol document to transform:

${rawText.substring(0, 10000)}

Generate ONLY the podcast script in the Canvas format shown above. Make it professional, engaging, and medically accurate.`

  const requestData = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: canvasPrompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'text/plain',
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  })

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData),
    },
  }

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          if (res.statusCode && res.statusCode >= 400) {
            throw new Error(`HTTP ${res.statusCode}: ${data}`)
          }

          const response = JSON.parse(data)

          if (response.candidates && response.candidates[0]) {
            const candidate = response.candidates[0]

            // Extract text from parts safely
            let canvasText = ''
            if (candidate.content && candidate.content.parts) {
              const textParts = candidate.content.parts
                .filter((part) => part.text && part.text.trim())
                .map((part) => part.text)

              if (textParts.length > 0) {
                canvasText = textParts.join('\n\n')
              }
            }

            if (canvasText) {
              console.log('✅ Canvas document generation completed')
              console.log(`📏 Generated script length: ${canvasText.length} characters`)
              resolve(canvasText)
            } else {
              throw new Error('No text content found in Canvas response')
            }
          } else if (response.error) {
            throw new Error(`Canvas API Error: ${response.error.message || response.error}`)
          } else {
            throw new Error('Invalid Canvas API response format')
          }
        } catch (error) {
          console.error('❌ Error processing Canvas response:', error.message)
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      console.error('❌ Canvas API network error:', error.message)
      reject(error)
    })

    // Set timeout
    req.setTimeout(60000, () => {
      req.destroy()
      reject(new Error('Canvas API timeout'))
    })

    req.write(requestData)
    req.end()
  })
}

/**
 * Main function for Canvas generation
 */
async function processProtocolToCanvas(inputFile, outputFile) {
  try {
    console.log('╔══════════════════════════════════════════════════════════════════════╗')
    console.log('║                      GEMINI CANVAS GENERATOR                         ║')
    console.log('║                   Protocol-to-Canvas Converter                       ║')
    console.log('╚══════════════════════════════════════════════════════════════════════╝')
    console.log('')

    // Step 1: Load protocol file
    console.log('📖 Reading protocol file...')
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`)
    }
    const rawText = fs.readFileSync(inputFile, 'utf8')
    console.log(`✅ Successfully loaded: ${inputFile}`)
    console.log(`📄 File size: ${rawText.length} characters`)

    // Step 2: Generate Canvas document using Gemini API
    const canvasDocument = await generateCanvasDocument(rawText)

    // Step 3: Save Canvas document
    fs.writeFileSync(outputFile, canvasDocument, 'utf8')
    console.log(`🎨 Canvas podcast script saved to: ${outputFile}`)

    console.log('')
    console.log('🎉 CANVAS GENERATION COMPLETED SUCCESSFULLY!')
    console.log(`📄 Canvas script: ${outputFile}`)
    console.log(`📊 Script length: ${canvasDocument.length} characters`)
    console.log('')
    console.log('💡 You can now use this Canvas script with gemini-audio.js to generate audio!')

    return {
      success: true,
      canvasFile: outputFile,
      scriptLength: canvasDocument.length,
    }
  } catch (error) {
    console.error('❌ Error in processProtocolToCanvas:', error.message)
    console.error('')
    console.error('💡 Troubleshooting tips:')
    console.error('   • Ensure GEMINI_API_KEY is properly configured')
    console.error('   • Check that the input file exists and is readable')
    console.error('   • Verify your internet connection')
    console.error('   • Try again in a few minutes if the service is overloaded')

    throw error
  }
}

/**
 * Main execution function
 */
async function main() {
  // Simple CLI args
  const args = process.argv.slice(2)
  const getArg = (name) => {
    const idx = args.indexOf(name)
    if (idx !== -1 && idx + 1 < args.length) return args[idx + 1]
    return null
  }

  const inputFile = getArg('--input') || './cellera-protocol-recommendation_output4.txt'
  const outputFile = getArg('--output') || './canvas-podcast-script.txt'

  try {
    const result = await processProtocolToCanvas(inputFile, outputFile)

    if (result.success) {
      console.log('✅ Process completed successfully!')
      console.log(`🎨 Canvas script: ${result.canvasFile}`)
    }
  } catch (error) {
    console.error('❌ Failed to generate Canvas script:', error.message)
    process.exit(1)
  }
}

// Export functions for potential integration with other modules
module.exports = {
  generateCanvasDocument,
  processProtocolToCanvas,
  main,
}

// Run if called directly
if (require.main === module) {
  main()
}