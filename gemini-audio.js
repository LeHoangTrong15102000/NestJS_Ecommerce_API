/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Gemini Audio Generation Feature
// Converts Canvas script text to MP3 audio using Gemini TTS
// To run:
//   node gemini-audio.js --input ./canvas-podcast-script.txt --output ./podcast-audio.mp3
//   node gemini-audio.js --input ./canvas-script.txt --output ./audio.mp3 --voice Aoede
// Requires env: GEMINI_API_KEY (export/set it before running)

const https = require('https')
const fs = require('fs')

/**
 * Generate audio using Gemini TTS API
 */
async function generateAudioFromText(text, outputFilename = 'podcast-audio.mp3', voiceName = 'Aoede') {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error('❌ GEMINI_API_KEY not configured! Please set your API key.')
  }

  console.log('🎵 Generating audio with Gemini TTS API...')
  console.log(`📊 Text length: ${text.length} characters`)
  console.log(`🎤 Voice: ${voiceName}`)

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
      // API expects text/plain here; audio is returned via inline_data
      responseMimeType: 'text/plain',
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
            if (candidate.content && candidate.content.parts && candidate.content.parts[0]) {
              const part = candidate.content.parts[0]

              if (part.inline_data && part.inline_data.data) {
                // Audio data is base64 encoded
                const audioData = part.inline_data.data
                const audioBuffer = Buffer.from(audioData, 'base64')

                // Prefer .mp3 extension when mimeType indicates MP3
                const mime = part.inline_data.mimeType || 'audio/mp3'
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
async function checkGeminiTtsAccess() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY is not set in this shell.')
    return { ok: false, reason: 'NO_API_KEY' }
  }

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

  const ttsResp = await httpRequest(ttsOptions, ttsRequest)
  if (ttsResp.status >= 400) {
    console.log('❌ TTS endpoint error:', ttsResp.body)
    return { ok: false, reason: 'TTS_ENDPOINT_ERROR', details: ttsResp.body }
  }
  console.log('✅ TTS endpoint OK')
  return { ok: true }
}

/**
 * Main function for Audio generation
 */
async function processCanvasToAudio(inputFile, outputAudioFile, options = {}) {
  try {
    console.log('╔══════════════════════════════════════════════════════════════════════╗')
    console.log('║                      GEMINI AUDIO GENERATOR                          ║')
    console.log('║                    Canvas-to-Audio Converter                         ║')
    console.log('╚══════════════════════════════════════════════════════════════════════╝')
    console.log('')

    const { voice = 'Aoede', dryRun = false } = options

    // Step 1: Load Canvas script
    console.log('📖 Reading Canvas script file...')
    if (!fs.existsSync(inputFile)) {
      throw new Error(`Canvas file not found: ${inputFile}`)
    }
    const canvasDocument = fs.readFileSync(inputFile, 'utf8')
    console.log(`✅ Loaded Canvas script: ${inputFile}`)
    console.log(`📄 File size: ${canvasDocument.length} characters`)

    // Optional early exit for dry-run
    if (dryRun) {
      console.log('🧪 Dry-run: Skipping TTS generation.')
      return {
        success: true,
        audioFile: outputAudioFile,
        processingTime: 0,
        dryRun: true,
      }
    }

    // Step 2: Generate audio using Gemini TTS
    console.log('🎵 Starting audio generation...')
    const startTime = Date.now()

    const result = await generateAudioFromText(canvasDocument, outputAudioFile, voice)

    const duration = Date.now() - startTime
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)

    console.log('')
    console.log('🎉 AUDIO GENERATION COMPLETED SUCCESSFULLY!')
    console.log(`⏱️  Processing time: ${minutes}m ${seconds}s`)
    console.log(`🎵 Audio file: ${outputAudioFile}`)
    console.log(`📊 File size: ${(result.size / 1024).toFixed(2)} KB`)
    console.log('')
    console.log('🎧 Your Canvas audio is ready!')
    console.log('💡 You can now play this audio file to hear your Canvas script.')

    return {
      success: true,
      audioFile: outputAudioFile,
      processingTime: duration,
    }
  } catch (error) {
    console.error('❌ Error in processCanvasToAudio:', error.message)
    console.error('')
    console.error('💡 Troubleshooting tips:')
    console.error('   • Ensure GEMINI_API_KEY is properly configured')
    console.error('   • Check that the Canvas file exists and is readable')
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

  const inputFile = getArg('--input') || './canvas-podcast-script.txt'
  const outputFile = getArg('--output') || './canvas-audio.mp3'
  const voice = getArg('--voice') || 'Aoede'
  const dryRun = hasFlag('--dry-run')
  const checkKey = hasFlag('--check-key')

  if (checkKey) {
    const result = await checkGeminiTtsAccess()
    if (result.ok) {
      console.log('✅ Gemini TTS access verified.')
      process.exit(0)
    } else {
      console.log('❌ Gemini TTS access issue:', result.reason)
      if (result.details) console.log(result.details)
      process.exit(1)
    }
  }

  try {
    const result = await processCanvasToAudio(inputFile, outputFile, {
      voice,
      dryRun,
    })

    if (result.success) {
      console.log('✅ Process completed successfully!')
      console.log(`🎵 Your audio file: ${result.audioFile}`)
      if (dryRun) console.log('🧪 Dry-run completed - no API calls made.')
    }
  } catch (error) {
    console.error('❌ Failed to generate audio:', error.message)
    process.exit(1)
  }
}

// Export functions for potential integration with other modules
module.exports = {
  generateAudioFromText,
  processCanvasToAudio,
  checkGeminiTtsAccess,
  main,
}

// Run if called directly
if (require.main === module) {
  main()
}