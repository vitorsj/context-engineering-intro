import type { PRPParsingConfig } from "../types/anthropic.js";

export const PRP_PARSING_SYSTEM_PROMPT = `You are an expert project management assistant specialized in parsing Product Requirement Prompts (PRPs) to extract actionable tasks, project metadata, and documentation.

Your role is to:
1. Identify and extract specific, actionable tasks from complex project descriptions
2. Categorize and prioritize tasks based on dependencies and importance
3. Extract project metadata including goals, target users, and value propositions
4. Organize supporting documentation by type and importance
5. Suggest relevant tags for project organization

Key principles:
- Focus on ACTIONABLE tasks, not high-level goals or concepts
- Maintain logical task dependencies and workflow order
- Provide realistic time estimates based on task complexity
- Extract detailed acceptance criteria when available
- Preserve important context and rationale`;

export const PRP_PARSING_FORMAT_INSTRUCTIONS = `**Response Requirements:**
- Return ONLY valid JSON with no additional text, markdown, or formatting
- Follow the exact schema structure provided
- Ensure all required fields are present and properly typed
- Use descriptive but concise language
- Maintain consistency in naming and terminology`;

export function buildPRPParsingPrompt(
  prpContent: string,
  projectContext?: string,
  config: PRPParsingConfig = {
    model: 'claude-3-sonnet-20240229',
    max_tokens: 4000,
    temperature: 0.1,
    include_context: true,
    extract_acceptance_criteria: true,
    suggest_tags: true,
    estimate_hours: true,
  }
): string {
  const contextSection = config.include_context && projectContext 
    ? `\n\n**Project Context:**\n${projectContext}\n` 
    : '';

  const acceptanceCriteriaInstruction = config.extract_acceptance_criteria
    ? '\n- Extract specific acceptance criteria for each task'
    : '';

  const hoursEstimationInstruction = config.estimate_hours
    ? '\n- Provide realistic hour estimates based on task complexity (consider: research, implementation, testing, documentation)'
    : '';

  const tagsInstruction = config.suggest_tags
    ? '\n- Suggest 3-8 relevant tags for categorization (e.g., frontend, backend, api, database, ui, testing, deployment)'
    : '';

  return `${PRP_PARSING_SYSTEM_PROMPT}

${contextSection}

**Analysis Instructions:**
Please analyze the PRP below and extract:

1. **Project Information:**
   - Clear, marketable project name
   - Concise project description (1-2 sentences)
   - Primary goals and objectives
   - Value proposition and why statement
   - Target user demographics and use cases

2. **Actionable Tasks:**
   - Break down into specific, implementable tasks
   - Assign priorities: urgent (critical path), high (important), medium (standard), low (nice-to-have)
   - Identify task dependencies based on logical workflow${acceptanceCriteriaInstruction}${hoursEstimationInstruction}

3. **Documentation:**
   - goals: Primary objectives and success metrics
   - why: Business case and value proposition
   - target_users: User personas and use cases
   - specifications: Technical requirements and constraints
   - notes: Additional context and considerations

4. **Organization:**${tagsInstruction}

${PRP_PARSING_FORMAT_INSTRUCTIONS}

**JSON Schema:**
{
  "project_info": {
    "name": "string (max 255 chars)",
    "description": "string (1-2 sentences)",
    "goals": "string (detailed objectives)",
    "why_statement": "string (value proposition)",
    "target_users": "string (user demographics and use cases)"
  },
  "tasks": [
    {
      "title": "string (specific, actionable task)",
      "description": "string (implementation guidance and context)",
      "priority": "urgent|high|medium|low",
      "estimated_hours": number,
      "tags": ["string", ...],
      "dependencies": ["task_title", ...],
      "acceptance_criteria": ["specific completion criteria", ...]
    }
  ],
  "documentation": [
    {
      "type": "goals|why|target_users|specifications|notes",
      "title": "string",
      "content": "string (detailed content)"
    }
  ],
  "suggested_tags": ["string", ...]
}

**PRP Content:**
${prpContent}

**Response:** (JSON only, no additional text)`;
}

export function buildTaskExtractionPrompt(
  prpContent: string,
  existingTasks: string[] = []
): string {
  const existingTasksSection = existingTasks.length > 0
    ? `\n\n**Existing Tasks to Avoid Duplicating:**\n${existingTasks.map(task => `- ${task}`).join('\n')}\n`
    : '';

  return `${PRP_PARSING_SYSTEM_PROMPT}

**Task Extraction Focus:**
Extract ONLY new, actionable tasks from this PRP content. Focus on:
- Specific implementation steps
- Testable deliverables
- Discrete work units (4-40 hours each)
- Clear dependencies and prerequisites

${existingTasksSection}

**Instructions:**
Return a JSON array of task objects following this schema:

{
  "tasks": [
    {
      "title": "Specific, actionable task title",
      "description": "Detailed implementation guidance",
      "priority": "urgent|high|medium|low",
      "estimated_hours": number,
      "tags": ["relevant", "tags"],
      "dependencies": ["prerequisite_task_titles"],
      "acceptance_criteria": ["testable completion criteria"]
    }
  ]
}

**PRP Content:**
${prpContent}

**Response:** (JSON only)`;
}

export function buildProjectMetadataPrompt(prpContent: string): string {
  return `${PRP_PARSING_SYSTEM_PROMPT}

**Project Metadata Extraction:**
Extract high-level project information from this PRP:

**Instructions:**
Focus on business objectives, target audience, and value proposition.
Return JSON following this schema:

{
  "project_info": {
    "name": "Clear, professional project name",
    "description": "Concise project summary (1-2 sentences)",
    "goals": "Primary objectives and success metrics",
    "why_statement": "Business value and motivation",
    "target_users": "User personas and use cases"
  },
  "documentation": [
    {
      "type": "goals|why|target_users|specifications",
      "title": "Document title",
      "content": "Detailed content"
    }
  ]
}

**PRP Content:**
${prpContent}

**Response:** (JSON only)`;
}

export function buildTaskRefinementPrompt(
  tasks: any[],
  projectContext: string
): string {
  return `${PRP_PARSING_SYSTEM_PROMPT}

**Task Refinement:**
Review and improve these extracted tasks for a project: ${projectContext}

**Current Tasks:**
${JSON.stringify(tasks, null, 2)}

**Improvements Needed:**
1. Ensure all tasks are specific and actionable
2. Validate time estimates are realistic
3. Check dependencies are logical and complete
4. Verify acceptance criteria are testable
5. Ensure priority assignments make sense

**Instructions:**
Return refined tasks in the same JSON format with improvements applied.

**Response:** (JSON only)`;
}

// Validation prompts for quality assurance
export function buildValidationPrompt(
  parsedData: any,
  originalPRP: string
): string {
  return `Validate this parsed PRP data for completeness and accuracy:

**Original PRP (first 500 chars):**
${originalPRP.substring(0, 500)}...

**Parsed Data:**
${JSON.stringify(parsedData, null, 2)}

**Validation Checklist:**
- [ ] All major features/requirements captured as tasks
- [ ] Task priorities reflect true importance and dependencies
- [ ] Time estimates are realistic (4-40 hours per task)
- [ ] Acceptance criteria are specific and testable
- [ ] Project metadata accurately reflects the PRP intent
- [ ] No critical tasks or requirements missing

Return a validation report in JSON format:
{
  "is_valid": boolean,
  "completeness_score": number (0-100),
  "issues": ["issue descriptions"],
  "missing_tasks": ["tasks that should be added"],
  "improvements": ["suggested improvements"]
}`;
}

// Specialized prompts for different PRP types
export const SPECIALIZED_PROMPTS = {
  web_application: `Additional focus for web applications:
- Separate frontend and backend tasks
- Include database schema and API design
- Consider authentication, authorization, and security
- Plan for responsive design and accessibility
- Include deployment and hosting considerations`,

  mobile_application: `Additional focus for mobile applications:
- Platform-specific considerations (iOS/Android)
- App store submission and approval process
- Device-specific features and permissions
- Performance optimization for mobile
- Offline functionality and data sync`,

  data_pipeline: `Additional focus for data pipelines:
- Data ingestion, transformation, and storage
- Data quality validation and error handling
- Monitoring and alerting systems
- Scalability and performance optimization
- Data governance and compliance requirements`,

  api_service: `Additional focus for API services:
- API design and documentation
- Authentication and rate limiting
- Input validation and error handling
- Testing strategies (unit, integration, load)
- Monitoring, logging, and observability`,
};

export function getSpecializedPrompt(projectType: keyof typeof SPECIALIZED_PROMPTS): string {
  return SPECIALIZED_PROMPTS[projectType] || '';
}