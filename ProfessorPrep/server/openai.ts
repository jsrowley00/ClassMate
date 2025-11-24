import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// This is using OpenAI's API directly with your own API key.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface Question {
  question: string;
  type: "multiple_choice" | "short_answer" | "fill_blank";
  options?: string[];
  correctAnswer: string;
}

// Helper function to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function generatePracticeTest(
  materialContent: string,
  testMode: string,
  questionCount: number = 10,
  learningObjectives: string[] = []
): Promise<Question[]> {
  let objectivesSection = "";
  if (learningObjectives.length > 0) {
    objectivesSection = `\n\nLEARNING OBJECTIVES:
The practice test questions should assess whether students have achieved these learning objectives:
${learningObjectives.map((obj, idx) => `${idx + 1}. ${obj}`).join('\n')}
`;
  }

  const prompt = `Based on the following study material, generate ${questionCount} practice test questions in ${testMode} format.
${objectivesSection}
Study Material:
${materialContent}

IMPORTANT INSTRUCTIONS:
1. ${learningObjectives.length > 0 ? 'Align questions with the learning objectives listed above to ensure targeted assessment\n2. ' : ''}Cover DIVERSE topics and concepts from the study material - do NOT focus on the same topic repeatedly
${learningObjectives.length > 0 ? '3' : '2'}. Ensure each question tests a DIFFERENT concept or topic whenever possible
${learningObjectives.length > 0 ? '4' : '3'}. VARY your question style and approach - use different formats like scenario-based, definition, application, comparison, and analysis questions
${learningObjectives.length > 0 ? '5' : '4'}. Even when assessing the same learning objective multiple times, ask it in DIFFERENT WAYS with different phrasing and angles
${learningObjectives.length > 0 ? '6' : '5'}. Spread questions across different sections of the material
${learningObjectives.length > 0 ? '7' : '6'}. Only repeat topics if there are fewer topics than the requested number of questions
${learningObjectives.length > 0 ? '8' : '7'}. Generate questions that test understanding of key concepts at different cognitive levels

Return your response as a JSON array of questions. Each question should have:
- question: The question text
- type: "${testMode === "multiple_choice" ? "multiple_choice" : testMode === "short_answer" ? "short_answer" : testMode === "fill_blank" ? "fill_blank" : "multiple_choice"}"
${testMode === "multiple_choice" ? '- options: An array of 4 answer choices' : ''}
- correctAnswer: The correct answer

For mixed mode, vary both the question types AND the topics covered.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert educator creating practice test questions. Generate clear, fair questions that test understanding of the material. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    const questions = parsed.questions || [];
    
    // Shuffle the questions to randomize their order
    return shuffleArray(questions);
  } catch (error) {
    console.error("Error generating practice test:", error);
    throw new Error("Failed to generate practice test");
  }
}

export interface CategorizedTopic {
  category: string;
  description: string;
  questions: Array<{
    questionText: string;
    studentName: string;
    studentEmail: string;
    studentId: string;
  }>;
}

export async function matchQuestionsToLearningObjectives(
  learningObjectivesData: Array<{
    moduleName: string;
    objectives: string[];
  }>,
  missedQuestions: Array<{
    questionText: string;
    studentName: string;
    studentEmail: string;
    studentId: string;
  }>
): Promise<CategorizedTopic[]> {
  try {
    // Create a flat list of objectives with their module context
    const allObjectives = learningObjectivesData.flatMap((mod, modIdx) =>
      mod.objectives.map((obj, objIdx) => ({
        moduleObjectiveId: `${modIdx}-${objIdx}`,
        moduleName: mod.moduleName,
        objective: obj,
      }))
    );

    if (allObjectives.length === 0) {
      throw new Error("No learning objectives available");
    }

    const questionsText = missedQuestions.map((q, idx) => `${idx + 1}. ${q.questionText}`).join('\n');
    const objectivesText = allObjectives.map((obj, idx) => 
      `${idx + 1}. [${obj.moduleName}] ${obj.objective}`
    ).join('\n');

    const prompt = `You are analyzing missed practice test questions for an educational course. Match each missed question to the most relevant learning objective from the course modules.

LEARNING OBJECTIVES (by module):
${objectivesText}

MISSED QUESTIONS:
${questionsText}

INSTRUCTIONS:
1. For each missed question, determine which learning objective it relates to most closely
2. Group all questions by their matching learning objective
3. A learning objective may have 0, 1, or multiple questions assigned to it
4. Only include learning objectives that have at least one missed question
5. The category name should be the full learning objective text
6. The description should mention the module name

Return a JSON object with this structure:
{
  "categories": [
    {
      "objectiveIndex": 0,  // Index of the learning objective (0-based, from the list above)
      "questionIndices": [0, 3, 7]  // Array of question indices (0-based) that relate to this objective
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert educational content analyst. Match missed questions to their corresponding learning objectives. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    const categories = parsed.categories || [];

    // Convert from indices to actual data
    const result: CategorizedTopic[] = categories
      .map((cat: { objectiveIndex: number; questionIndices: number[] }) => {
        const objIdx = cat.objectiveIndex;
        if (objIdx < 0 || objIdx >= allObjectives.length) return null;

        const objective = allObjectives[objIdx];
        const questions = (cat.questionIndices || [])
          .filter((idx: number) => idx >= 0 && idx < missedQuestions.length)
          .map((idx: number) => missedQuestions[idx]);

        if (questions.length === 0) return null;

        return {
          category: objective.objective,
          description: `From ${objective.moduleName}`,
          questions,
        };
      })
      .filter((cat: CategorizedTopic | null): cat is CategorizedTopic => cat !== null);

    return result;
  } catch (error) {
    console.error("Error matching questions to learning objectives:", error);
    throw error;
  }
}

export async function categorizeQuestionsIntoTopics(
  materialContent: string,
  missedQuestions: Array<{
    questionText: string;
    studentName: string;
    studentEmail: string;
    studentId: string;
  }>
): Promise<CategorizedTopic[]> {
  try {
    const questionsText = missedQuestions.map((q, idx) => `${idx + 1}. ${q.questionText}`).join('\n');
    
    const prompt = `You are analyzing practice test questions for an educational course. Based on the course material and the list of questions students missed, identify 6-12 broad study topic categories and assign each question to the most appropriate category.

Course Material (summarized):
${materialContent.substring(0, 8000)}

Questions Students Missed:
${questionsText}

INSTRUCTIONS:
1. Identify broad study topics from the course material (e.g., "Efficiency vs Effectiveness", "Market Structures", "Cell Division", etc.)
2. Create 6-12 meaningful categories that group related concepts together
3. Assign EACH question to exactly ONE category
4. Categories should be high-level topics, not specific question details

Return a JSON object with this structure:
{
  "categories": [
    {
      "category": "Category Name",
      "description": "Brief description of what this category covers",
      "questionIndices": [0, 3, 7]  // Array of question indices (0-based) that belong to this category
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert educational content analyst. Categorize questions into meaningful study topics based on course content. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    const categories = parsed.categories || [];
    
    // Convert from indices to actual question data
    const result: CategorizedTopic[] = categories.map((cat: any) => ({
      category: cat.category || "Uncategorized",
      description: cat.description || "",
      questions: (cat.questionIndices || [])
        .filter((idx: number) => idx >= 0 && idx < missedQuestions.length)
        .map((idx: number) => missedQuestions[idx]),
    }));

    return result;
  } catch (error) {
    console.error("Error categorizing questions with AI:", error);
    // Fallback: Group questions by simple keyword extraction
    // This provides better categorization than a single bucket
    const topicMap = new Map<string, typeof missedQuestions>();
    
    for (const question of missedQuestions) {
      // Extract key topic words (simplified grouping)
      const text = question.questionText.toLowerCase();
      let topic = "General Concepts";
      
      // Try to extract meaningful keywords
      if (text.includes("efficiency") || text.includes("effectiveness")) {
        topic = "Efficiency & Effectiveness";
      } else if (text.includes("market") || text.includes("economic")) {
        topic = "Market & Economics";
      } else if (text.includes("process") || text.includes("method")) {
        topic = "Processes & Methods";
      } else if (text.includes("theory") || text.includes("principle")) {
        topic = "Theory & Principles";
      } else if (text.includes("data") || text.includes("analysis")) {
        topic = "Data & Analysis";
      } else {
        // Use first few words as topic
        const words = question.questionText.split(/\s+/).slice(0, 4).join(" ");
        topic = words.length > 50 ? words.substring(0, 47) + "..." : words;
      }
      
      if (!topicMap.has(topic)) {
        topicMap.set(topic, []);
      }
      topicMap.get(topic)!.push(question);
    }
    
    // Convert to expected format
    return Array.from(topicMap.entries()).map(([category, questions]) => ({
      category,
      description: `Questions related to ${category.toLowerCase()}`,
      questions,
    }));
  }
}

export interface FlashcardItem {
  front: string;
  back: string;
}

export async function generateFlashcards(
  materialContent: string,
  cardCount: number = 20,
  learningObjectives: string[] = []
): Promise<FlashcardItem[]> {
  let objectivesSection = "";
  if (learningObjectives.length > 0) {
    objectivesSection = `\n\nLEARNING OBJECTIVES:
The flashcards should help students achieve these learning objectives:
${learningObjectives.map((obj, idx) => `${idx + 1}. ${obj}`).join('\n')}
`;
  }

  const prompt = `Based on the following study material, generate ${cardCount} flashcards to help students study and prepare.
${objectivesSection}
Study Material:
${materialContent}

IMPORTANT INSTRUCTIONS:
1. Create flashcards that cover KEY concepts, terms, and facts from the material
${learningObjectives.length > 0 ? '2. Align flashcards with the learning objectives listed above to ensure targeted study\n3' : '2'}. The FRONT should be a question, term, or prompt
${learningObjectives.length > 0 ? '4' : '3'}. The BACK should be the answer, definition, or explanation
${learningObjectives.length > 0 ? '5' : '4'}. Cover DIVERSE topics across the entire material - don't focus on one section
${learningObjectives.length > 0 ? '6' : '5'}. VARY your flashcard style - use different prompt types like definitions, applications, comparisons, fill-in-the-blank cues, scenario-based questions, and cause-effect relationships
${learningObjectives.length > 0 ? '7' : '6'}. Even when covering the same learning objective, use DIFFERENT PHRASINGS and approaches to test understanding from multiple angles
${learningObjectives.length > 0 ? '8' : '7'}. Create flashcards that test different levels of understanding (recall, comprehension, application)
${learningObjectives.length > 0 ? '9' : '8'}. Keep each card focused on ONE concept or fact
${learningObjectives.length > 0 ? '10' : '9'}. Make questions clear and concise

Return your response as a JSON array of flashcards. Each flashcard should have:
- front: The question, term, or prompt
- back: The answer, definition, or explanation`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert educator creating study flashcards. Generate clear, educational flashcards that help students learn and retain information. Respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 8192,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("No content in response");
    }

    const parsed = JSON.parse(content);
    const flashcards = parsed.flashcards || [];
    
    // Shuffle flashcards to ensure random order every time
    return shuffleArray(flashcards);
  } catch (error) {
    console.error("Error generating flashcards:", error);
    throw new Error("Failed to generate flashcards");
  }
}

export async function generateTutorResponse(
  studentQuestion: string,
  materialContent: string,
  conversationHistory: { role: string; content: string }[] = [],
  missedQuestions: { question: string; studentAnswer: string; correctAnswer: string }[] = [],
  learningObjectives: string[] = []
): Promise<string> {
  try {
    let learningObjectivesSection = "";
    if (learningObjectives.length > 0) {
      // Cap learning objectives at 15 to avoid overwhelming the prompt
      const cappedObjectives = learningObjectives.slice(0, 15);
      learningObjectivesSection = `\n\nLEARNING OBJECTIVES:
Students are expected to achieve the following learning objectives:
${cappedObjectives.map((obj, idx) => `${idx + 1}. ${obj}`).join('\n')}

When helping students, guide them toward mastering these objectives through Socratic questioning.
`;
    }

    let missedQuestionsContext = "";
    if (missedQuestions.length > 0) {
      // Summarize missed questions to keep prompt concise
      const summaries = missedQuestions.map((mq) => {
        // Extract key concepts from question (first 100 chars as topic indicator)
        const topic = mq.question.substring(0, 100).replace(/\n/g, ' ').trim();
        const topicSummary = topic.length < mq.question.length ? topic + "..." : topic;
        
        return {
          topic: topicSummary,
          missed: true
        };
      });

      missedQuestionsContext = `\n\nRECENT PRACTICE TEST RESULTS:
The student recently struggled with these concepts on practice tests:
${summaries.map((s, idx) => `${idx + 1}. ${s.topic}`).join('\n')}

IMPORTANT: When the student asks for help with practice test topics or struggles, PROACTIVELY address these specific concepts. Start by acknowledging their recent test and ask which topic they'd like to focus on first. Be specific and reference these actual topics.`;
    }

    const messages: any[] = [
      {
        role: "system",
        content: `You are a Socratic AI tutor who helps students learn through conversation and thoughtful questions. Your goal is to guide students to discover answers themselves, not to simply provide information.

TEACHING APPROACH:
- Ask probing questions that help students think critically about the material
- Break complex topics into smaller, digestible concepts through dialogue
- Check understanding by asking the student to explain concepts in their own words
- Encourage deeper thinking with "why" and "how" questions
- Only provide direct answers when a student is genuinely stuck after multiple attempts
- Celebrate insights and correct reasoning to build confidence

CONVERSATION STYLE:
- Be warm, encouraging, and conversational (not lecture-style)
- Use natural language like a study partner would
- Ask one focused question at a time
- Acknowledge student responses before asking follow-ups
- Guide them toward the answer rather than giving it away immediately

CRITICAL RESPONSE RULES:
- Keep responses SHORT (2-3 sentences max)
- Focus on ONE concept or question at a time
- Avoid long explanations - use brief hints instead
- Don't dump information - let the conversation unfold gradually

CELEBRATE UNDERSTANDING & NEXT STEPS:
- Watch for signs the student is mastering concepts: explaining ideas correctly, expressing confidence, or successfully applying guidance
- After the student demonstrates solid understanding (e.g., two correct explanations or confident statements), offer an empathetic check-in
- Ask how they're feeling about the material and suggest they try a practice test to reinforce their learning
- Keep this invitation natural and brief (within your 2-3 sentence limit)
- Example: "You're really getting this! How are you feeling about everything now? Might be a good time to try a practice test to see how much you've learned."
- Only offer this once per conversation to avoid being repetitive

If the student asks something unrelated to the course material, gently redirect them back to course topics.
${learningObjectivesSection}
Course Material:
${materialContent}${missedQuestionsContext}`,
      },
      ...conversationHistory.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      })),
      {
        role: "user",
        content: studentQuestion,
      },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages,
      max_completion_tokens: 8192,
    });

    return response.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error generating tutor response:", error);
    throw new Error("Failed to generate tutor response");
  }
}

export async function generateLearningObjectives(
  moduleName: string,
  moduleDescription: string,
  materialContent: string
): Promise<string[]> {
  try {
    const systemPrompt = `You are an educational expert who creates clear, measurable learning objectives for course modules. Generate 4-6 specific learning objectives that students should achieve after studying this module's content.

Each objective should:
- Start with an action verb (e.g., "Explain", "Apply", "Analyze", "Compare", "Demonstrate")
- Be specific and measurable
- Focus on what students will be able to do
- Align with the content provided

Format: Return ONLY a JSON array of strings, like: ["objective 1", "objective 2", ...]`;

    const userPrompt = `Module: ${moduleName}
${moduleDescription ? `Description: ${moduleDescription}\n` : ''}
Content summary:
${materialContent}

Generate 4-6 learning objectives for this module.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
    });

    const responseText = response.choices[0].message.content?.trim() || '[]';
    
    // Parse the objectives array
    try {
      const objectives = JSON.parse(responseText);
      if (!Array.isArray(objectives)) {
        throw new Error("Response is not an array");
      }
      return objectives;
    } catch (parseError) {
      console.error("Failed to parse objectives:", responseText);
      // Return a fallback set of generic objectives
      return [
        `Understand the key concepts covered in ${moduleName}`,
        `Apply the principles learned in ${moduleName}`,
        `Analyze and evaluate information related to ${moduleName}`
      ];
    }
  } catch (error) {
    console.error("Error generating learning objectives:", error);
    throw new Error("Failed to generate learning objectives");
  }
}
