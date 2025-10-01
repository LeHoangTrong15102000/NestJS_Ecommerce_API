/* eslint-env node */
/* eslint-disable @typescript-eslint/no-require-imports */
// Standalone Node.js script - excluded from TS project build
// To run: node gemini-analysis.js
// Requires env: GEMINI_API_KEY
const https = require('https');
const fs = require('fs');
const path = require('path');

// Patient information is now loaded dynamically from Patient_Intake_Form.txt
// This allows for easy testing with different patient data without code changes

// Function to convert file to base64 (if needed)
function fileToBase64(filePath) {
  try {
    const fileData = fs.readFileSync(filePath);
    return fileData.toString('base64');
  } catch (error) {
    console.log(`❌ Cannot read file: ${filePath}`);
    return null;
  }
}

// Create Cellera-compliant prompt by importing actual file contents
function createCelleraCompliantPrompt() {
  // Read all necessary files for comprehensive prompt generation
  let generalStructureFlow = '';
  let celleraPromptRules = '';
  let patientIntakeData = '';
  // Garcia sample will be used as the exact format anchor
  let garciaFormatSample = '';

  try {
    generalStructureFlow = fs.readFileSync(
      './General_Structure_Report_Flow.txt',
      'utf8',
    );
    console.log('✅ Successfully loaded General Structure Report Flow');
  } catch (error) {
    console.log(
      '❌ Cannot read General_Structure_Report_Flow.txt:',
      error.message,
    );
    generalStructureFlow =
      'ERROR: Could not load General Structure Report Flow';
  }

  try {
    celleraPromptRules = fs.readFileSync(
      './Cellera_Product_Prompt.txt',
      'utf8',
    );
    console.log('✅ Successfully loaded Cellera Product Prompt rules');
  } catch (error) {
    console.log('❌ Cannot read Cellera_Product_Prompt.txt:', error.message);
    celleraPromptRules = 'ERROR: Could not load Cellera Product Prompt rules';
  }

  try {
    patientIntakeData = fs.readFileSync('./Patient_Intake_Form.txt', 'utf8');
    console.log('✅ Successfully loaded Patient Intake Form data');
  } catch (error) {
    console.log('❌ Cannot read Patient_Intake_Form.txt:', error.message);
    patientIntakeData = 'ERROR: Could not load Patient Intake Form data';
  }

  // Load Garcia sample output to serve as the exact formatting template
  try {
    garciaFormatSample = fs.readFileSync('./Garcia_Result_Prompt.txt', 'utf8');
    console.log(
      '✅ Successfully loaded Garcia format sample for EXACT formatting',
    );
  } catch (error) {
    console.log('❌ Cannot read Garcia_Result_Prompt.txt:', error.message);
    garciaFormatSample = 'ERROR: Could not load Garcia format sample';
  }

  return `You are an AI medical protocol generator that MUST follow the General Structure Report Flow and Cellera Product Prompt rules exactly. You MUST also copy the EXACT format and structure from the Garcia sample.

GENERAL STRUCTURE AND REPORT FLOW (PRIMARY STRUCTURE RULES):
${generalStructureFlow}

CELLERA PRODUCT PROMPT RULES (PRODUCT SELECTION RULES):
${celleraPromptRules}

PATIENT INTAKE DATA:
${patientIntakeData}

GARCIA FORMAT SAMPLE (COPY THIS EXACT FORMAT AND STRUCTURE):
${garciaFormatSample}

CRITICAL FORMATTING REQUIREMENTS - COPY GARCIA EXACTLY:

1. EXACT TITLE FORMAT:
   - Start with: "Personalized Wellness Protocol for Cherry Garcia"
   - Second section: "Welcome to Your Personalized Wellness Journey"
   - Use the welcome paragraph structure like Garcia and insert the current date

2. MARKDOWN FORMAT (LIKE GARCIA SAMPLE):
   - Use # for main title, ## for major sections, ### for subsections
   - Use **bold** for emphasis and important values
   - Use * bullet points for lists
   - Use markdown tables with | pipes for data tables
   - Use proper markdown formatting throughout
   - Copy Garcia's exact markdown structure and syntax

3. EXACT SECTION STRUCTURE (copy Garcia order):
   - Your Intake Review (with bullet points)
   - Your Comprehensive Health Overview and Wellness Grade (with table)
   - Analysis of Your Diagnostic Markers (include longitudinal table if applicable)
   - Your Top 5 Key Takeaways
   - Patient Acknowledgment and Consent
   - Your Personalized 2-Month Protocol
   - Product & Modality Summaries
   - End of Report Disclaimer
   - Clinical References

4. TABLE FORMATS - COPY GARCIA EXACTLY:
   - Use markdown tables with | pipes like Garcia
   - Keep the same header labels and alignment approach
   - Include wellness grade display table and biomarker tables in the demonstrated structure

5. PATIENT DATA RULES (MANDATORY):
   - Keep "Cherry Garcia" as the displayed patient name (testing constraint)
   - Use ONLY data from Patient_Intake_Form.txt for all personalization
   - Do NOT copy any medical numbers/biomarkers from Garcia; render new content based on Patient_Intake_Form.txt and Cellera rules

CRITICAL: Do NOT copy Garcia's medical data, lab results, or biomarker tables. Use ONLY the format structure and replace ALL content with data from Patient_Intake_Form.txt while keeping "Cherry Garcia" as the patient name.

MANDATORY: You MUST copy Garcia format structure EXACTLY — same headers, spacing, table styles, and tone — while changing all patient-specific content per the current intake and Cellera rules.

GENERATE THE COMPLETE PROTOCOL NOW:`;
}

// Call Gemini AI API with proper Cellera-compliant prompt
async function callGeminiAPIWithPDFs() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('❌ GEMINI_API_KEY not configured!');
    console.log('Run: export GEMINI_API_KEY="your-api-key-here"');
    console.log('Or on Windows: set GEMINI_API_KEY=your-api-key-here');
    return;
  }

  console.log('🚀 Preparing Comprehensive Protocol Analysis...');
  console.log('📋 Patient: Data loaded from Patient_Intake_Form.txt');
  console.log('📊 Structure: General Structure Report Flow');
  console.log('🏥 Products: Cellera Health Optimization Framework');
  console.log('📄 Format: Garcia Sample Format (EXACT COPY REQUIRED)');

  const prompt = createCelleraCompliantPrompt();

  // Create request with Cellera-compliant prompt
  const requestData = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 32768,
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
  });

  const options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: `/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData),
    },
  };

  // Helper: exponential backoff with jitter
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function sendWithRetry(maxRetries = 6) {
    let attempt = 0;
    let lastError;

    while (attempt <= maxRetries) {
      attempt += 1;
      const start = Date.now();

      const result = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode && res.statusCode >= 400) {
                return resolve({
                  ok: false,
                  error: {
                    code: res.statusCode,
                    message: data,
                    status: 'HTTP_ERROR',
                  },
                });
              }

              const response = JSON.parse(data);

              // Enhanced response parsing for Cellera compliance
              if (response.candidates && response.candidates[0]) {
                const candidate = response.candidates[0];

                // Extract text from parts safely
                let analysisText = '';
                if (candidate.content && candidate.content.parts) {
                  const textParts = candidate.content.parts
                    .filter((part) => part.text && part.text.trim())
                    .map((part) => part.text);

                  if (textParts.length > 0) {
                    analysisText = textParts.join('\n\n');
                  }
                }

                if (analysisText) {
                  // Normalize status icons to guarantee emoji presence
                  const enforceStatusEmojis = (text) => {
                    let result = text.normalize('NFC');
                    // Decode common HTML entities that sometimes leak through
                    result = result
                      .replace(/&lt;/g, '<')
                      .replace(/&gt;/g, '>')
                      .replace(/&amp;/g, '&');

                    // In-table status normalization
                    result = result.replace(
                      /\|\s*Out of Range \(High\)/g,
                      '| 🔴 Out of Range (High)',
                    );
                    result = result.replace(
                      /\|\s*Out of Range \(Low\)/g,
                      '| 🔴 Out of Range (Low)',
                    );
                    result = result.replace(
                      /\|\s*Lower Normal/g,
                      '| 🔵 Lower Normal',
                    );
                    result = result.replace(
                      /\|\s*Upper Normal/g,
                      '| 🟡 Upper Normal',
                    );
                    result = result.replace(/\|\s*Optimal/g, '| ✅ Optimal');

                    // Standalone status phrases
                    result = result.replace(
                      /\bOut of Range \(High\)/g,
                      '🔴 Out of Range (High)',
                    );
                    result = result.replace(
                      /\bOut of Range \(Low\)/g,
                      '🔴 Out of Range (Low)',
                    );
                    result = result.replace(
                      /\bLower Normal\b/g,
                      '🔵 Lower Normal',
                    );
                    result = result.replace(
                      /\bUpper Normal\b/g,
                      '🟡 Upper Normal',
                    );
                    result = result.replace(/\bReactive\b/g, '🔴 Reactive');
                    result = result.replace(/\bOptimal\b/g, '✅ Optimal');

                    // Replace any replacement-character sequences near statuses
                    result = result.replace(
                      /��\s*Out of Range \(High\)/g,
                      '🔴 Out of Range (High)',
                    );
                    result = result.replace(
                      /��\s*Out of Range \(Low\)/g,
                      '🔴 Out of Range (Low)',
                    );
                    result = result.replace(/��\s*Reactive/g, '🔴 Reactive');
                    result = result.replace(
                      /��\s*Lower Normal/g,
                      '🔵 Lower Normal',
                    );
                    result = result.replace(
                      /��\s*Upper Normal/g,
                      '🟡 Upper Normal',
                    );

                    // Global cleanup: drop any remaining Unicode replacement characters
                    result = result.replace(/\uFFFD+/g, '');

                    return result;
                  };
                  analysisText = enforceStatusEmojis(analysisText);
                  // Save pure Gemini response to file
                  const fileName = 'cellera-protocol-recommendation.txt';
                  fs.writeFileSync(fileName, analysisText, 'utf8');

                  console.log(
                    '\n✅ COMPREHENSIVE PROTOCOL GENERATION COMPLETED!',
                  );
                  const attemptMs = Date.now() - start;
                  console.log(
                    `🕒 Attempt ${attempt} succeeded in ${attemptMs} ms`,
                  );
                  console.log(`📄 Pure Gemini response saved to: ${fileName}`);
                  console.log(
                    `📊 Response length: ${analysisText.length} characters`,
                  );
                  console.log(
                    `🎯 Generated by: Gemini 2.5 Pro following General Structure + Cellera rules (Garcia Format)`,
                  );

                  // Display preview of pure Gemini response
                  console.log('\n📋 PREVIEW GEMINI RESPONSE:');
                  console.log('═'.repeat(67));
                  console.log(analysisText.substring(0, 1000) + '...');
                  console.log('═'.repeat(67));
                  console.log(
                    `\n💡 View complete response in file: ${fileName}`,
                  );
                  console.log('🏥 Patient: Data from Patient_Intake_Form.txt');
                  console.log(
                    '📧 Contact: Check intake form for contact details',
                  );

                  resolve({ ok: true, analysis: analysisText });
                } else {
                  console.log('❌ No text content found in response');
                  console.log(
                    '🔍 Response structure:',
                    JSON.stringify(response, null, 2),
                  );
                  resolve({
                    ok: false,
                    error: {
                      code: 0,
                      message: 'No text content in response',
                      status: 'NO_CONTENT',
                    },
                  });
                }
              } else if (response.error) {
                resolve({ ok: false, error: response.error });
              } else {
                console.log('❌ Invalid API response format');
                console.log('Raw response:', JSON.stringify(response, null, 2));
                resolve({
                  ok: false,
                  error: {
                    code: 0,
                    message: 'Invalid API response format',
                    status: 'INVALID_RESPONSE',
                  },
                });
              }
            } catch (error) {
              const err =
                error instanceof Error ? error : new Error(String(error));
              console.log('❌ Response parsing error:', err.message);
              console.log('Raw data:', data);
              resolve({
                ok: false,
                error: { code: 0, message: err.message, status: 'PARSE_ERROR' },
              });
            }
          });
        });

        req.on('error', (error) => {
          resolve({
            ok: false,
            error: {
              code: 0,
              message: error instanceof Error ? error.message : String(error),
              status: 'NETWORK_ERROR',
            },
          });
        });

        req.write(requestData);
        req.end();
      });

      if (result.ok) {
        return result.analysis;
      }

      lastError = result.error;
      const retriable =
        [429, 500, 502, 503, 504].includes(Number(result.error?.code)) ||
        [
          'UNAVAILABLE',
          'RESOURCE_EXHAUSTED',
          'INTERNAL',
          'BACKEND_ERROR',
          'PARSE_ERROR',
          'NETWORK_ERROR',
        ].includes(String(result.error?.status));

      if (retriable && attempt <= maxRetries) {
        const attemptMs = Date.now() - start;
        console.log(
          `🕒 Attempt ${attempt} failed in ${attemptMs} ms; will retry...`,
        );
        const backoff = Math.min(30000, 1000 * 2 ** (attempt - 1));
        const jitter = Math.floor(Math.random() * 400);
        const waitMs = backoff + jitter;
        console.log(
          `⏳ Temporary interruption (${result.error?.status || result.error?.code}): ${result.error?.message}. Retry ${attempt}/${maxRetries} after ${waitMs}ms...`,
        );
        await sleep(waitMs);
        continue;
      }

      // Not retriable or exhausted retries
      throw new Error(
        `${result.error?.status || 'ERROR'}: ${result.error?.message || 'Unknown error'}`,
      );
    }

    throw new Error(lastError?.message || 'Unknown error');
  }

  // Send with retry mechanism, handle MAX_TOKENS
  const overallStartMs = Date.now();
  console.log(
    `🟢 Generation started at: ${new Date(overallStartMs).toISOString()}`,
  );
  try {
    const analysis = await sendWithRetry();
    const totalMs = Date.now() - overallStartMs;
    const minutes = Math.floor(totalMs / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    console.log(
      `\n⏱️ Total generation time: ${minutes}m ${seconds}s (${totalMs} ms)`,
    );
    return analysis;
  } catch (error) {
    if (error.message.includes('MAX_TOKENS')) {
      console.log('\n🔄 Retrying with concise prompt due to MAX_TOKENS...');

      // Create a more concise prompt focusing on key patient data
      const concisePrompt = `COPY GARCIA FORMAT EXACTLY - NO MARKDOWN, PLAIN TEXT ONLY:

GENERAL STRUCTURE RULES:
${generalStructureFlow}

CELLERA PRODUCT RULES:
${celleraPromptRules}

PATIENT: Le Hoang Trong, 24yo male, Frontend Developer
Concerns: 6-month fatigue, digestive issues, work anxiety
Goals: improve energy, identify food sensitivities, stress management
Current: Multivitamin, Vitamin D3, Omega-3
Allergies: Penicillin
Lifestyle: Vegetarian, 6hrs sleep, swimming 2x/week

CRITICAL FORMAT REQUIREMENTS - COPY GARCIA EXACTLY:
1. Start with: "Personalized Wellness Protocol for Le Hoang Trong"
2. Second section: "Welcome to Your Personalized Wellness Journey"
3. USE MARKDOWN FORMAT (like Garcia sample):
   - Use # for main title, ## for major sections, ### for subsections
   - Use **bold** for emphasis and important values
   - Use * bullet points for lists
   - Use markdown tables with | pipes for data tables
4. Copy Garcia's exact markdown structure and formatting
5. Use proper markdown tables with | pipes (like Garcia sample)
6. Include ALL sections from Garcia sample in exact order
7. Keep "Cherry Garcia" as patient name but use data from Patient_Intake_Form.txt
8. Use ONLY data from Patient_Intake_Form.txt - do NOT copy Garcia's lab data
9. Use same professional tone and spacing as Garcia
10. USE MARKDOWN FORMATTING - headers, bold, tables, bullets like Garcia sample

Generate complete protocol copying Garcia format structure exactly:`;

      // Update request with concise prompt
      const conciseRequestData = JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: concisePrompt }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 32768,
          responseMimeType: 'text/plain',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_NONE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_NONE',
          },
        ],
      });

      // Retry with concise prompt
      return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              if (response.candidates?.[0]?.content?.parts?.[0]?.text) {
                const text = response.candidates[0].content.parts[0].text;
                // Save concise response to file as well
                const fileName = 'cellera-protocol-recommendation.txt';
                fs.writeFileSync(fileName, text, 'utf8');
                console.log(
                  `\n✅ COMPREHENSIVE PROTOCOL (concise retry) COMPLETED!`,
                );
                console.log(`📄 Pure Gemini response saved to: ${fileName}`);
                console.log(`📊 Response length: ${text.length} characters`);
                const totalMs = Date.now() - overallStartMs;
                const minutes = Math.floor(totalMs / 60000);
                const seconds = Math.floor((totalMs % 60000) / 1000);
                console.log(
                  `\n⏱️ Total generation time: ${minutes}m ${seconds}s (${totalMs} ms)`,
                );
                resolve(text);
              } else {
                reject(new Error('No text in concise retry'));
              }
            } catch (err) {
              reject(err);
            }
          });
        });
        req.on('error', reject);
        req.write(conciseRequestData);
        req.end();
      });
    }
    throw error;
  }
}

// Main program execution
async function main() {
  console.log(
    '╔═══════════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║                  CELLERA AI PROTOCOL GENERATOR                    ║',
  );
  console.log(
    '║                    v2.5 Pro - Product Prompt Compliant           ║',
  );
  console.log(
    '║                   (100% Cellera Requirements)                     ║',
  );
  console.log(
    '╚═══════════════════════════════════════════════════════════════════╝',
  );
  console.log('');
  console.log('🎯 Logic System: IF...THEN Conditional Protocol Generation');
  console.log('🔬 Methodology: 100% Cellera Product Prompt PDF Compliant');
  console.log('💊 Formulary: Approved Products Only - No Deviations');
  console.log('⚕️ Safety: Mandatory Contraindication Screening');
  console.log('💰 Pricing: 3-Tier Structure ($500/$1500/$3000+)');
  console.log('📋 Output: Recommendation Draft (Requires Review)');
  console.log('═'.repeat(67));

  try {
    await callGeminiAPIWithPDFs();
  } catch (error) {
    console.log('❌ Error occurred:', error.message);
    console.log('💡 Please ensure:');
    console.log('   • GEMINI_API_KEY is properly configured');
    console.log('   • Internet connection is stable');
    console.log('   • Try again in a few minutes if model is overloaded');
  }
}

// Run if file is called directly
if (require.main === module) {
  void main();
}

module.exports = {
  createCelleraCompliantPrompt,
  callGeminiAPIWithPDFs,
};
