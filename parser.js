/**
 * PDF Resume Parser Helper Functions
 * 
 * These functions help parse PDF resumes into structured data
 * Can be imported and used in your existing system
 */

const { PDFExtract } = require('pdf.js-extract');

/**
 * Extracts text content from a PDF file
 * @param {Buffer|ArrayBuffer} pdfBuffer - The PDF file as a buffer
 * @returns {Promise<Array>} - Array of pages with text content
 */
async function extractTextFromPdf(pdfBuffer) {
    const pdfExtract = new PDFExtract();
    const options = {
        // Set any custom extraction options here
        normalizeWhitespace: true,
        disableCombineTextItems: false
    };

    try {
        const data = await pdfExtract.extractBuffer(
            Buffer.isBuffer(pdfBuffer) ? pdfBuffer : Buffer.from(pdfBuffer)
        );

        return data.pages.map(page => ({
            pageNumber: page.pageInfo.num,
            content: page.content.map(item => item.str).join(' '),
            // Include raw items for more detailed processing if needed
            items: page.content
        }));
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        throw error;
    }
}

/**
 * Fetch a PDF from a URL and return as buffer
 * @param {string} url - URL of the PDF file
 * @returns {Promise<Buffer>} - PDF file as buffer
 */
async function fetchPdfFromUrl(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) {
        console.error('Error fetching PDF:', error);
        throw error;
    }
}

/**
 * Convert base64 PDF data to buffer
 * @param {string} base64Data - Base64 encoded PDF data
 * @returns {Buffer} - PDF file as buffer
 */
function base64ToPdfBuffer(base64Data) {
    // Remove data URL prefix if present
    const cleanedBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');
    return Buffer.from(cleanedBase64, 'base64');
}

/**
 * Extract contact information from resume text
 * @param {string} text - Full text of the resume
 * @returns {Object} - Extracted contact information
 */
function extractContactInfo(text) {
    const contactInfo = {
        email: null,
        phone: null,
        linkedin: null,
        website: null,
        location: null
    };

    // Email extraction
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = text.match(emailRegex);
    if (emails && emails.length > 0) {
        contactInfo.email = emails[0];
    }

    // Phone extraction (handles various formats)
    const phoneRegex = /\b(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
    const phones = text.match(phoneRegex);
    if (phones && phones.length > 0) {
        contactInfo.phone = phones[0];
    }

    // LinkedIn extraction
    const linkedinRegex = /(?:linkedin\.com\/in\/[A-Za-z0-9_-]+)/gi;
    const linkedinProfiles = text.match(linkedinRegex);
    if (linkedinProfiles && linkedinProfiles.length > 0) {
        contactInfo.linkedin = linkedinProfiles[0];
    }

    // Website extraction
    const websiteRegex = /(?:https?:\/\/)?(?:www\.)?([A-Za-z0-9-]+\.[A-Za-z0-9.-]+)/gi;
    const websites = text.match(websiteRegex);
    if (websites && websites.length > 0) {
        // Filter out linkedin and common email domains
        const filteredWebsites = websites.filter(site =>
            !site.includes('linkedin.com') &&
            !site.includes('gmail.com') &&
            !site.includes('yahoo.com') &&
            !site.includes('hotmail.com')
        );
        if (filteredWebsites.length > 0) {
            contactInfo.website = filteredWebsites[0];
        }
    }

    // Location extraction (basic approach - will need refinement)
    // This is a simplistic approach that looks for common location patterns
    const locationRegex = /(?:located in|location|address|city|state|country|region)(?:[:\s]+)([A-Za-z\s,.-]+)(?:\.|,|$)/i;
    const locationMatch = text.match(locationRegex);
    if (locationMatch && locationMatch.length > 1) {
        contactInfo.location = locationMatch[1].trim();
    }

    return contactInfo;
}

/**
 * Extract education information from resume text
 * @param {string} text - Full text of the resume
 * @returns {Array} - Array of education entries
 */
function extractEducation(text) {
    const educationSectionRegex = /\b(?:EDUCATION|ACADEMIC BACKGROUND|ACADEMIC CREDENTIALS|ACADEMIC HISTORY)\b(?:[\s\S]*?)(?:\b(?:EXPERIENCE|SKILLS|PROJECTS|CERTIFICATIONS)\b|$)/i;
    const educationSectionMatch = text.match(educationSectionRegex);

    if (!educationSectionMatch) return [];

    const educationSection = educationSectionMatch[0];

    // Look for common patterns in education entries
    const educationEntryRegex = /(?:University|College|School|Institute)(?:[^\n]*)\n(?:[^\n]*)/gi;
    const educationEntries = [];

    let match;
    while ((match = educationEntryRegex.exec(educationSection)) !== null) {
        const entryText = match[0];

        // Try to extract degree information
        const degreeRegex = /\b(?:Bachelor|Master|PhD|BS|BA|MSc|MA|MBA|Diploma|Certificate|BSc|BBA)\b[^,\n]*/i;
        const degreeMatch = entryText.match(degreeRegex);

        // Try to extract dates
        const dateRegex = /\b(?:19|20)\d{2}\s*(?:-|–|to)\s*(?:(?:19|20)\d{2}|Present|Current|Now)\b/i;
        const dateMatch = entryText.match(dateRegex);

        educationEntries.push({
            institution: match[0].split('\n')[0].trim(),
            degree: degreeMatch ? degreeMatch[0].trim() : null,
            duration: dateMatch ? dateMatch[0].trim() : null
        });
    }

    return educationEntries;
}

/**
 * Extract work experience from resume text
 * @param {string} text - Full text of the resume
 * @returns {Array} - Array of experience entries
 */
function extractExperience(text) {
    const experienceSectionRegex = /\b(?:EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|WORK HISTORY|PROFESSIONAL EXPERIENCE)\b(?:[\s\S]*?)(?:\b(?:EDUCATION|SKILLS|PROJECTS|CERTIFICATIONS)\b|$)/i;
    const experienceSectionMatch = text.match(experienceSectionRegex);

    if (!experienceSectionMatch) return [];

    const experienceSection = experienceSectionMatch[0];

    // Split by dates to identify different roles
    const dateRegex = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\s*(?:-|–|to)\s*(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|Present|Current|Now)\b/gi;

    // Alternative approach looking for company names
    const companyRegex = /\b(?:[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*)*)\s*(?:Inc\.|LLC|Ltd\.|Limited|Corp\.|Corporation|Company)?\b(?:,|\n|\r|$)/g;

    const experienceEntries = [];
    let companies = [];
    let match;

    // Extract companies
    while ((match = companyRegex.exec(experienceSection)) !== null) {
        companies.push({
            name: match[0].replace(/,|\n|\r/g, '').trim(),
            index: match.index
        });
    }

    // Match dates
    const dates = [];
    while ((match = dateRegex.exec(experienceSection)) !== null) {
        dates.push({
            duration: match[0],
            index: match.index
        });
    }

    // Try to match companies with dates
    for (let i = 0; i < companies.length; i++) {
        const company = companies[i];

        // Find the closest date after this company
        let closestDate = null;
        let minDistance = Infinity;

        for (const date of dates) {
            const distance = date.index - company.index;
            if (distance > 0 && distance < minDistance) {
                minDistance = distance;
                closestDate = date;
            }
        }

        // Extract position (typically appears between company and date)
        let position = null;
        if (closestDate) {
            const positionText = experienceSection.substring(
                company.index + company.name.length,
                closestDate.index
            );

            // Simple heuristic: position is often on its own line or after a separator
            const positionMatch = positionText.match(/(?:\n|\r|,|:)\s*([A-Za-z\s]+)/);
            if (positionMatch) {
                position = positionMatch[1].trim();
            }
        }

        experienceEntries.push({
            company: company.name,
            position: position || "Not specified",
            duration: closestDate ? closestDate.duration : null
        });
    }

    return experienceEntries;
}

/**
 * Extract skills from resume text
 * @param {string} text - Full text of the resume
 * @returns {Array} - Array of skills
 */
function extractSkills(text) {
    // First, try to find a dedicated skills section
    const skillsSectionRegex = /\b(?:SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|KEY SKILLS|PROFESSIONAL SKILLS)\b(?:[\s\S]*?)(?:\b(?:EXPERIENCE|EDUCATION|PROJECTS|CERTIFICATIONS)\b|$)/i;
    const skillsSectionMatch = text.match(skillsSectionRegex);

    // List of common technical skills to look for
    const commonSkills = [
        // Programming languages
        "JavaScript", "Python", "Java", "C\\+\\+", "C#", "Ruby", "PHP", "Swift", "Kotlin", "Go", "Rust", "TypeScript",
        // Web technologies
        "HTML", "CSS", "React", "Angular", "Vue", "Node.js", "Express", "Django", "Flask", "Spring", "ASP.NET",
        // Databases
        "SQL", "MySQL", "PostgreSQL", "MongoDB", "Oracle", "SQLite", "Redis", "Cassandra", "DynamoDB",
        // Cloud & DevOps
        "AWS", "Azure", "Google Cloud", "Docker", "Kubernetes", "Jenkins", "Git", "GitHub", "GitLab", "CI/CD",
        // Other technical skills
        "Machine Learning", "AI", "Data Science", "Big Data", "Hadoop", "Spark", "TensorFlow", "PyTorch",
        // Soft skills (less reliable to extract)
        "Leadership", "Communication", "Teamwork", "Problem Solving", "Critical Thinking", "Project Management"
    ];

    const skillsRegex = new RegExp(`\\b(${commonSkills.join("|")})\\b`, "gi");
    const extractedSkills = new Set();

    // If we found a skills section, look for skills there
    if (skillsSectionMatch) {
        const skillsText = skillsSectionMatch[0];
        let match;

        while ((match = skillsRegex.exec(skillsText)) !== null) {
            extractedSkills.add(match[0]);
        }

        // Also look for bullet point or comma-separated lists in the skills section
        const listItemsRegex = /(?:•|\*|\-|,|\n)\s*([A-Za-z0-9\s\/\+\#]+)(?=•|\*|\-|,|\n|$)/g;
        while ((match = listItemsRegex.exec(skillsText)) !== null) {
            if (match[1] && match[1].trim()) {
                extractedSkills.add(match[1].trim());
            }
        }
    }

    // If we didn't find many skills, look through the entire document
    if (extractedSkills.size < 5) {
        let match;
        while ((match = skillsRegex.exec(text)) !== null) {
            extractedSkills.add(match[0]);
        }
    }

    return Array.from(extractedSkills);
}

/**
 * Main function to parse a resume from a PDF buffer
 * @param {Buffer|ArrayBuffer} pdfBuffer - The PDF file as a buffer
 * @returns {Promise<Object>} - Parsed resume data
 */
async function parseResume(pdfBuffer) {
    try {
        console.log(pdfBuffer);

        // Extract text from PDF
        const pages = await extractTextFromPdf(pdfBuffer);
        console.log('Extracted pages:', pages);


        // Combine all page content
        const fullText = pages.map(page => page.content).join(' ');
        console.log('Full text:', fullText);

        // Extract the name (usually at the beginning of the resume)
        // This is a simplistic approach and might need refinement
        const nameRegex = /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/m;
        const nameMatch = fullText.match(nameRegex);
        const name = nameMatch ? nameMatch[1] : null;

        // Extract different sections
        const contactInfo = extractContactInfo(fullText);
        const education = extractEducation(fullText);
        const experience = extractExperience(fullText);
        const skills = extractSkills(fullText);

        return {
            name,
            contactInfo,
            education,
            experience,
            skills,
            // Include raw text for debugging or further processing
            rawText: fullText,
        };
    } catch (error) {
        console.error('Error parsing resume:', error);
        throw error;
    }
}

/**
 * Parse a resume from a URL
 * @param {string} url - URL of the PDF resume
 * @returns {Promise<Object>} - Parsed resume data
 */
async function parseResumeFromUrl(url) {
    const pdfBuffer = await fetchPdfFromUrl(url);
    return parseResume(pdfBuffer);
}

/**
 * Parse a resume from base64 data
 * @param {string} base64Data - Base64 encoded PDF data
 * @returns {Promise<Object>} - Parsed resume data
 */
async function parseResumeFromBase64(base64Data) {
    const pdfBuffer = base64ToPdfBuffer(base64Data);
    return parseResume(pdfBuffer);
}

module.exports = {
    parseResume,
    parseResumeFromUrl,
    parseResumeFromBase64,
    extractTextFromPdf,
    extractContactInfo,
    extractEducation,
    extractExperience,
    extractSkills,
    fetchPdfFromUrl,
    base64ToPdfBuffer
};