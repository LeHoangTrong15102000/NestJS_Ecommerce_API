/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Gemini Canvas + Audio Overview Feature Implementation
// Simulates Canvas formatting and uses Gemini TTS API for audio generation
// To run examples:
//   1) From raw protocol -> Canvas -> MP3
//      node gemini-canvas-audio.js --input ./cellera-protocol-recommendation_output4.txt --output ./cellera-protocol-audio-overview.mp3
//   2) From existing Canvas script directly to MP3
//      node gemini-canvas-audio.js --from-canvas ./cellera-protocol-recommendation_output4_canvas_podcast_script.txt --output ./canvas-overview.mp3
//   3) Dry-run to validate inputs without hitting the API
//      node gemini-canvas-audio.js --from-canvas ./script.txt --dry-run
// Requires env: GEMINI_API_KEY (export/set it before running)

const https = require('https')
const fs = require('fs')
const path = require('path')

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
 * Generate audio using Gemini TTS API
 */
async function generateAudioFromText(text, outputFilename = 'protocol-audio-overview.mp3', voiceName = 'Aoede') {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('❌ GEMINI_API_KEY not configured! Please set your API key.')
  }

  console.log('🎵 Generating audio with Gemini TTS API...')
  console.log(`📊 Text length: ${text.length} characters`)

  // Prepare the request payload for TTS
  const requestData = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: text,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      topK: 1,
      topP: 0.1,
      maxOutputTokens: 8192,
      // Request MP3 audio directly
      responseMimeType: 'audio/mp3',
      response_modalities: ['AUDIO'],
      speech_config: {
        voice_config: {
          prebuilt_voice_config: {
            voice_name: voiceName,
          },
        },
      },
    },
  })

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/gemini-2.5-pro-preview-tts:generateContent?key=${apiKey}`,
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

            // Check if audio data is available
            if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
              const part =
                candidate.content.parts.find((p) => p.inline_data || p.inlineData) || candidate.content.parts[0]

              const inline = part.inline_data || part.inlineData
              if (inline && inline.data) {
                // Audio data is base64 encoded
                const audioData = inline.data
                const audioBuffer = Buffer.from(audioData, 'base64')

                // Prefer .mp3 extension when mimeType indicates MP3
                const mime = inline.mimeType || 'audio/mp3'
                let outFile = outputFilename
                if (mime === 'audio/mp3' && !outputFilename.endsWith('.mp3')) {
                  outFile = outputFilename.replace(/\.[^.]+$/, '.mp3')
                }

                // Save audio file
                fs.writeFileSync(outFile, audioBuffer)

                console.log('✅ Audio generation completed successfully!')
                console.log(`🎵 Audio saved to: ${outFile}`)
                console.log(`📊 Audio file size: ${audioBuffer.length} bytes`)

                resolve({
                  success: true,
                  filename: outFile,
                  size: audioBuffer.length,
                })
              } else {
                // Fallback: if no audio data, the model might have returned text
                // In this case, we'll need to use a different approach
                throw new Error('No audio data returned. TTS model may not be available.')
              }
            } else {
              throw new Error('Invalid response structure from Gemini API')
            }
          } else if (response.error) {
            throw new Error(`API Error: ${response.error.message || response.error}`)
          } else {
            throw new Error('Unexpected response format from Gemini API')
          }
        } catch (error) {
          console.error('❌ Error processing audio response:', error.message)
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      console.error('❌ Network error:', error.message)
      reject(error)
    })

    // Set timeout
    req.setTimeout(120000, () => {
      req.destroy()
      reject(new Error('Request timeout - TTS generation took too long'))
    })

    req.write(requestData)
    req.end()
  })
}

/**
 * Quick diagnostics: validate API key and TTS model availability
 */
async function checkGeminiKeyAndTtsAccess() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY is not set in this shell.')
    return { ok: false, reason: 'NO_API_KEY' }
  }

  const minimalText = 'ping'
  const requestData = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: minimalText }],
      },
    ],
    generationConfig: { maxOutputTokens: 8 },
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

  function httpRequest(opts, body) {
    return new Promise((resolve) => {
      const req = https.request(opts, (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => resolve({ status: res.statusCode || 0, body: data }))
      })
      req.on('error', (err) => resolve({ status: 0, body: String(err) }))
      req.write(body)
      req.end()
    })
  }

  console.log('🧪 Checking Gemini text endpoint access...')
  const textResp = await httpRequest(options, requestData)
  if (textResp.status >= 400) {
    console.log('❌ Text endpoint error:', textResp.body)
    return { ok: false, reason: 'TEXT_ENDPOINT_ERROR', details: textResp.body }
  }
  console.log('✅ Text endpoint OK')

  console.log('🧪 Checking TTS model access...')
  const ttsRequest = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
    generationConfig: {
      responseMimeType: 'text/plain',
      response_modalities: ['AUDIO'],
      speech_config: { voice_config: { prebuilt_voice_config: { voice_name: 'Aoede' } } },
      maxOutputTokens: 8,
    },
  })
  const ttsOptions = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/gemini-2.5-pro-preview-tts:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(ttsRequest),
    },
  }
  const ttsResp = await httpRequest(ttsOptions, ttsRequest)
  if (ttsResp.status >= 400) {
    console.log('❌ TTS endpoint error:', ttsResp.body)
    return { ok: false, reason: 'TTS_ENDPOINT_ERROR', details: ttsResp.body }
  }
  console.log('✅ TTS endpoint OK')
  return { ok: true }
}

/**
 * Fallback TTS implementation using Google Cloud Text-to-Speech
 */
async function fallbackTextToSpeech(text, outputFilename) {
  console.log('🔄 Using Google Cloud TTS fallback...')

  try {
    // Use simple edge-tts as fallback (Microsoft Edge TTS)
    console.log('🎤 Attempting edge-tts (Microsoft Edge voices)...')

    const { spawn } = require('child_process')

    return new Promise((resolve, reject) => {
      // Try edge-tts command
      const edgeTts = spawn('edge-tts', [
        '--text',
        text,
        '--write-media',
        outputFilename,
        '--voice',
        'en-US-AriaNeural',
      ])

      let stderr = ''
      edgeTts.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      edgeTts.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputFilename)) {
          const stats = fs.statSync(outputFilename)
          console.log('✅ Edge TTS completed successfully!')
          console.log(`🎵 Audio saved to: ${outputFilename}`)
          console.log(`📊 Audio file size: ${stats.size} bytes`)
          resolve({
            success: true,
            filename: outputFilename,
            size: stats.size,
          })
        } else {
          console.log('❌ Edge TTS failed or not installed')
          console.log('💡 To install: pip install edge-tts')
          console.log('💡 Then retry the audio generation')
          reject(new Error(`Edge TTS failed with code ${code}: ${stderr}`))
        }
      })

      edgeTts.on('error', (error) => {
        console.log('❌ Edge TTS not available:', error.message)
        console.log('💡 Install with: pip install edge-tts')
        reject(error)
      })
    })
  } catch (error) {
    console.log('❌ Fallback TTS error:', error.message)
    console.log('')
    console.log('💡 Fallback options:')
    console.log('   1. Install edge-tts: pip install edge-tts')
    console.log('   2. Wait for Gemini quota reset (24 hours)')
    console.log('   3. Upgrade to Gemini paid plan')
    console.log('   4. Use external TTS service')

    return {
      success: false,
      error: 'All TTS methods failed',
    }
  }
}

/**
 * Main function that orchestrates Canvas formatting + Audio generation
 */
async function processProtocolToAudio(inputFile, outputAudioFile, options = {}) {
  try {
    console.log('╔══════════════════════════════════════════════════════════════════════╗')
    console.log('║                   GEMINI CANVAS + AUDIO OVERVIEW                     ║')
    console.log('║                   Protocol-to-Audio Converter                        ║')
    console.log('╚══════════════════════════════════════════════════════════════════════╝')
    console.log('')

    const { fromCanvasPath, dryRun = false, voice = 'Aoede' } = options

    // Step 1: Load content
    let canvasDocument = ''
    let canvasDocumentFile = ''

    if (fromCanvasPath) {
      // Use existing Canvas-formatted script directly
      console.log('📖 Reading existing Canvas script...')
      if (!fs.existsSync(fromCanvasPath)) {
        throw new Error(`Canvas file not found: ${fromCanvasPath}`)
      }
      canvasDocument = fs.readFileSync(fromCanvasPath, 'utf8')
      canvasDocumentFile = fromCanvasPath
      console.log(`✅ Loaded Canvas script: ${fromCanvasPath}`)
      console.log(`📄 File size: ${canvasDocument.length} characters`)
    } else {
      // Full pipeline: raw protocol -> Canvas -> audio
      console.log('📖 Reading protocol file...')
      if (!fs.existsSync(inputFile)) {
        throw new Error(`Input file not found: ${inputFile}`)
      }
      const rawText = fs.readFileSync(inputFile, 'utf8')
      console.log(`✅ Successfully loaded: ${inputFile}`)
      console.log(`📄 File size: ${rawText.length} characters`)

      // Step 2: Generate Canvas document using Gemini API
      if (dryRun) {
        console.log('🧪 Dry-run: Skipping Canvas generation API call.')
        canvasDocument = rawText.substring(0, 2000)
      } else {
        canvasDocument = await generateCanvasDocument(rawText)
      }

      // Step 3: Save Canvas document for reference
      canvasDocumentFile = inputFile.replace('.txt', '_canvas_podcast_script.txt')
      fs.writeFileSync(canvasDocumentFile, canvasDocument, 'utf8')
      console.log(`🎨 Canvas podcast script saved to: ${canvasDocumentFile}`)
    }

    // Optional early exit for dry-run
    if (dryRun) {
      console.log('🧪 Dry-run: Skipping TTS generation.')
      return {
        success: true,
        audioFile: outputAudioFile,
        canvasDocumentFile,
        processingTime: 0,
        dryRun: true,
      }
    }

    // Step 4: Generate audio using Gemini TTS with chunking, no fallback
    console.log('🎵 Starting audio generation...')
    const startTime = Date.now()

    // Split long scripts into smaller chunks to reduce timeouts/quota spikes
    const maxCharsPerChunk = 1200
    const paragraphs = canvasDocument
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0)

    const chunks = []
    let current = ''
    for (const para of paragraphs) {
      if ((current + '\n\n' + para).length <= maxCharsPerChunk) {
        current = current ? current + '\n\n' + para : para
      } else {
        if (current) chunks.push(current)
        if (para.length <= maxCharsPerChunk) {
          current = para
        } else {
          // Hard split very long paragraph
          for (let i = 0; i < para.length; i += maxCharsPerChunk) {
            chunks.push(para.slice(i, i + maxCharsPerChunk))
          }
          current = ''
        }
      }
    }
    if (current) chunks.push(current)

    console.log(`🧩 Total chunks: ${chunks.length}`)

    const partBuffers = []
    for (let i = 0; i < chunks.length; i++) {
      const partIndex = i + 1
      const label = partIndex.toString().padStart(3, '0')
      console.log(`🎙️  Generating chunk ${partIndex}/${chunks.length}...`)

      // Retry a few times per chunk for transient 503/429
      let attempt = 0
      let lastErr
      while (attempt < 3) {
        attempt += 1
        try {
          const tempFile = outputAudioFile.replace(/\.mp3$/i, `.${label}.mp3`)
          const res = await generateAudioFromText(chunks[i], tempFile, voice)
          const data = fs.readFileSync(tempFile)
          partBuffers.push(data)
          // Remove temp to keep folder clean
          try {
            fs.unlinkSync(tempFile)
          } catch {}
          break
        } catch (err) {
          lastErr = err
          console.log(
            `⏳ Retry ${attempt}/3 for chunk ${partIndex} due to: ${err instanceof Error ? err.message : String(err)}`,
          )
          await new Promise((r) => setTimeout(r, 1500 * attempt))
        }
      }
      if (lastErr && partBuffers.length < partIndex) {
        throw lastErr
      }
    }

    // Concatenate MP3 buffers (safe for MP3 stream)
    const finalBuffer = Buffer.concat(partBuffers)
    fs.writeFileSync(outputAudioFile, finalBuffer)

    const duration = Date.now() - startTime
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)

    console.log('')
    console.log('🎉 AUDIO GENERATION COMPLETED SUCCESSFULLY!')
    console.log(`⏱️  Processing time: ${minutes}m ${seconds}s`)
    console.log(`🎵 Audio file: ${outputAudioFile}`)
    console.log(`📊 File size: ${(finalBuffer.length / 1024).toFixed(2)} KB`)
    console.log('')
    console.log('🎧 Your protocol audio overview is ready!')
    console.log('💡 You can now play this audio file to hear your personalized wellness protocol.')

    return {
      success: true,
      audioFile: outputAudioFile,
      canvasDocumentFile: canvasDocumentFile,
      processingTime: duration,
    }
  } catch (error) {
    console.error('❌ Error in processProtocolToAudio:', error.message)
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

  const hasFlag = (flag) => args.includes(flag)

  const inputFile = getArg('--input') || './cellera-protocol-recommendation_output4.txt'
  const outputFile = getArg('--output') || './cellera-protocol-audio-overview.mp3'
  const fromCanvas = getArg('--from-canvas')
  const voice = getArg('--voice') || 'Aoede'
  const dryRun = hasFlag('--dry-run')
  const checkKey = hasFlag('--check-key')

  if (checkKey) {
    const result = await checkGeminiKeyAndTtsAccess()
    if (result.ok) {
      console.log('✅ Gemini API key and TTS access verified.')
      process.exit(0)
    } else {
      console.log('❌ Gemini key or access issue:', result.reason)
      if (result.details) console.log(result.details)
      process.exit(1)
    }
  }

  try {
    const result = await processProtocolToAudio(inputFile, outputFile, {
      fromCanvasPath: fromCanvas,
      voice,
      dryRun,
    })

    if (result.success) {
      console.log('✅ Process completed successfully!')
      console.log(`🎵 Your audio overview: ${result.audioFile}`)
      console.log(`🎨 Canvas podcast script: ${result.canvasDocumentFile}`)
      if (dryRun) console.log('🧪 Dry-run completed - no API calls made.')
    }
  } catch (error) {
    console.error('❌ Failed to generate audio overview:', error.message)
    process.exit(1)
  }
}

// Export functions for potential integration with other modules
module.exports = {
  generateCanvasDocument,
  generateAudioFromText,
  processProtocolToAudio,
  main,
}

// Run if called directly
if (require.main === module) {
  main()
}
