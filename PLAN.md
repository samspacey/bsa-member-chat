# BSA Member Chat Demo - Implementation Plan

## Overview
Transform the current MVP (limited to Monmouthshire Building Society) into a full demo with 10 varied building societies, 4 universal persona templates, and an improved two-step selection UI.

## Phase 1: Data Collection & Scraping

### Selected 10 Building Societies (Mixed Portfolio)
1. **Nationwide Building Society** - Largest (£270bn+ assets)
2. **Yorkshire Building Society** - Major player (£50bn+ assets) 
3. **Coventry Building Society** - Large regional (£60bn+ assets)
4. **Skipton Building Society** - Mid-size regional (£25bn+ assets)
5. **Leeds Building Society** - Regional focus (£20bn+ assets)
6. **Principality Building Society** - Welsh specialist (£10bn+ assets)
7. **Monmouthshire Building Society** - Small regional (£3bn+ assets, already done)
8. **Cumberland Building Society** - Community focus (£2bn+ assets)
9. **Bath Building Society** - Small specialist (£1bn+ assets)
10. **Ecology Building Society** - Ethical specialist (£300m+ assets)

**Rationale**: Mix of sizes (mega/large/medium/small), geographic spread, different specialisms (mainstream, regional, ethical, Welsh-focused).

### Data Collection Per Society
For each of the 9 new societies, scrape and store:

#### 1. BSA Directory Information
- Contact details & head office
- Basic stats (if publicly available)
- **Source**: BSA member directory (already have)

#### 2. Website Content
- **Products page(s)**: Mortgages, savings, ISAs, current accounts
- **Branch locations**: Store locator data, opening hours
- **About page**: History, values, mission, community focus
- **News/press releases**: Recent 6-12 months for trends
- **Mortgage criteria**: LTV limits, income multiples, specialist products

#### 3. Trustpilot Reviews
- **Recent reviews** (last 12 months)
- **Rating breakdown** by category
- **Common themes**: Service quality, branch experience, app/digital, complaints
- **Customer sentiment**: What they love/hate

#### 4. Additional Context Sources
- **Recent annual reports** (if publicly available)
- **Local media coverage** (branch closures, community involvement)
- **Specialist mortgage press** (for product positioning)

### File Structure
```
societies/
├── nationwide/
│   ├── bsa-info.md
│   ├── website/
│   │   ├── products.md
│   │   ├── branches.md
│   │   ├── about.md
│   │   └── news.md
│   ├── trustpilot/
│   │   ├── reviews-2024.md
│   │   └── sentiment-analysis.md
│   └── context/
│       └── additional-sources.md
├── yorkshire/
│   └── [same structure]
├── coventry/
│   └── [same structure]
└── [etc for all 10]
```

### Token Cost Estimation
- **Web scraping**: ~50-100 pages × 10 societies = 500-1000 pages
- **Average page**: 2,000 tokens to process
- **Trustpilot reviews**: ~200 reviews × 10 = 2,000 reviews
- **Review processing**: ~500 tokens per review
- **Total estimate**: 2-3M tokens (~$30-60) for scraping and initial processing
- **Ongoing costs**: Minimal (data stored as markdown)

## Phase 2: Universal Persona Templates

### Template Structure (YAML)
Create reusable templates in `personas/templates/`:

#### 1. loyalist.yaml
```yaml
archetype: loyalist
name_template: "{first_name} {surname}"
age_range: [70, 80]
demographics:
  life_stage: "Retired"
  occupation_history: "{traditional_job}"
  tech_comfort: "Low"
relationship_pattern:
  loyalty_factor: "Very high"
  branch_preference: "Strongly prefers branches"
  staff_relationships: "Knows staff by name"
  visit_frequency: "Weekly"
concerns:
  - "Branch closures"
  - "Digital push"
  - "Service quality decline"
communication_style:
  tone: "Direct but polite"
  formality: "Formal"
  emotional_expression: "Moderate"
```

#### 2. digital_native.yaml
```yaml
archetype: digital_native
name_template: "{modern_first_name} {surname}"
age_range: [25, 35]
demographics:
  life_stage: "First-time buyer"
  occupation: "{tech_profession}"
  tech_comfort: "Very high"
relationship_pattern:
  loyalty_factor: "Low (rate shopping)"
  channel_preference: "App/online only"
  expectations: "Instant everything"
concerns:
  - "Outdated technology"
  - "Slow processes"
  - "High rates"
communication_style:
  tone: "Casual, direct"
  formality: "Informal"
  tech_references: "Natural"
```

#### 3. family.yaml
```yaml
archetype: family
name_template: "{family_first_name} {surname}"
age_range: [35, 50]
demographics:
  life_stage: "Young family"
  dependents: "2-3 children"
  housing: "Family home owner"
relationship_pattern:
  loyalty_factor: "Medium (value-driven)"
  channel_preference: "Mixed (convenience-driven)"
  decision_making: "Careful, research-heavy"
concerns:
  - "School fees"
  - "Remortgage rates"
  - "Children's savings"
  - "Future security"
communication_style:
  tone: "Practical, focused"
  formality: "Semi-formal"
  time_pressure: "High"
```

#### 4. business_owner.yaml
```yaml
archetype: business_owner
name_template: "{professional_first_name} {surname}"
age_range: [45, 60]
demographics:
  life_stage: "Established professional"
  business_type: "{small_business}"
  income_complexity: "Variable"
relationship_pattern:
  loyalty_factor: "High (relationship-driven)"
  service_expectation: "Personal relationship manager"
  decision_factors: ["Trust", "Expertise", "Flexibility"]
concerns:
  - "Business lending criteria"
  - "Personal guarantees"
  - "Relationship continuity"
  - "Service quality"
communication_style:
  tone: "Professional, assertive"
  formality: "Business-appropriate"
  expertise_level: "High"
```

### Hydration Process
Templates get filled with society-specific data:
- Local branch names and staff
- Specific products owned
- Society-specific issues from reviews/news
- Geographic context (Welsh for Principality, Northern for Cumberland)

## Phase 3: API Backend Changes

### Current vs New Architecture

#### Current (app/api/chat/route.ts)
- Hardcoded persona loading
- Single society knowledge file
- Static system prompt

#### New Design
```typescript
interface ChatRequest {
  messages: Message[];
  societyId: string;    // NEW
  personaArchetype: string; // NEW (instead of fixed personaId)
}

// New functions to add:
function loadSocietyKnowledge(societyId: string): SocietyKnowledge
function loadPersonaTemplate(archetype: string): PersonaTemplate  
function hydratePersona(template: PersonaTemplate, society: SocietyKnowledge): HydratedPersona
function buildContextualSystemPrompt(persona: HydratedPersona): string
```

### Implementation Steps

1. **Add society knowledge loader**
   - Read all markdown files from `societies/{societyId}/`
   - Parse and structure data
   - Cache for performance

2. **Add persona hydration**
   - Load template YAML
   - Fill placeholders with society-specific data
   - Generate realistic names, addresses, specific products

3. **Update system prompt builder**
   - Include society-specific branch names
   - Reference local review themes
   - Add geographic context

4. **Maintain conversation style**
   - Keep existing short conversational style instruction
   - Preserve authentic character voice

### Breaking Changes
- API now requires both `societyId` and `personaArchetype`
- Old fixed `personaId` system removed
- Backward compatibility: support old format during transition

## Phase 4: Frontend Updates

### Current vs New User Journey

#### Current
1. Select persona (Margaret/Rhys only)
2. Chat immediately

#### New
1. **Society Selection Screen**: Grid of 10 societies with logos/names
2. **Persona Selection Screen**: 4 archetype cards
3. **Chat Interface**: With society context and switch option

### UI Components to Add/Update

#### 1. Society Selection (New Screen)
```tsx
// Components needed:
<SocietyGrid societies={societies} onSelect={setSociety} />
<SocietyCard society={society} />
```

Features:
- Responsive grid (2 cols mobile, 3-4 desktop)
- Society logos (scrape or use initials)
- Basic info: Name, location, size category
- Search/filter by size or region

#### 2. Persona Selection (Enhanced)
```tsx
// Enhanced from current persona selection
<PersonaGrid archetypes={archetypes} society={selectedSociety} onSelect={setPersona} />
<PersonaCard archetype={archetype} society={society} />
```

Features:
- Show archetype with society-specific examples
- "Margaret (74) from {society} - visits {local branch} weekly"
- Clear archetype descriptions

#### 3. Chat Interface (Updated)
```tsx
// Add to existing chat header:
<SocietySwitchButton onClick={resetToSocietySelection} />
<PersonaContext society={society} persona={persona} />
```

Features:
- Society logo/name in header
- Persona context always visible
- Easy way to switch society or persona
- Mobile-friendly layout

### State Management
```typescript
interface AppState {
  selectedSociety: Society | null;
  selectedPersonaArchetype: string | null;
  hydratedPersona: HydratedPersona | null;
  messages: Message[];
  currentScreen: 'society' | 'persona' | 'chat';
}
```

### Mobile Considerations
- Touch-friendly selection grids
- Horizontal scroll for society logos on mobile
- Collapsible context in chat header
- Bottom navigation for easy switching

## Phase 5: Technical Implementation Details

### New Dependencies Needed
```json
{
  "dependencies": {
    // Already have js-yaml for persona templates
    "fuse.js": "^7.0.0"  // For society search/filter
  }
}
```

### File Processing Utilities
```typescript
// utils/dataLoader.ts
class SocietyKnowledgeLoader {
  static loadSociety(id: string): SocietyKnowledge
  static loadAllSocieties(): Society[]
  static buildSocietyIndex(): SearchIndex
}

// utils/personaHydrator.ts  
class PersonaHydrator {
  static hydrateTemplate(template: PersonaTemplate, society: SocietyKnowledge): HydratedPersona
  static generateContextualDetails(archetype: string, society: Society): PersonaDetails
}
```

### Error Handling & Fallbacks
- Graceful degradation if society data missing
- Default to generic responses for missing society info
- Fallback personas if hydration fails
- Clear error messages for users

## Phase 6: Timeline & Priorities

### Tonight (4-6 hours) ✅
- [x] Create this implementation plan
- [ ] Set up society directory structure
- [ ] Scrape 2-3 societies (Nationwide, Yorkshire, Coventry) for immediate testing
- [ ] Create persona templates
- [ ] Update API to accept societyId parameter

### Tomorrow (6-8 hours)
- [ ] Complete remaining society scraping
- [ ] Implement persona hydration system
- [ ] Build society selection UI
- [ ] Update persona selection with society context
- [ ] Test end-to-end flow

### Polish Phase (2-4 hours)
- [ ] Add society logos/branding
- [ ] Mobile responsiveness testing
- [ ] Performance optimization
- [ ] Demo script preparation

## Phase 7: Demo Readiness

### Conference Presentation Flow
1. **Show society variety**: "We have 10 different building societies"
2. **Pick a large vs small**: Compare Nationwide vs Bath experiences  
3. **Same persona, different societies**: Show how loyalist differs by context
4. **Different personas, same society**: Show range of member concerns
5. **Realistic conversations**: Demonstrate authentic pushback and concerns

### Key Demo Scenarios
- **Branch closure concern**: Loyalist + small society
- **Digital frustration**: Digital native + traditional society  
- **Rate shopping**: Family + multiple society comparison
- **Relationship need**: Business owner + personal service expectation

### Success Metrics
- **Realistic conversations**: People recognize authentic member voices
- **Society differentiation**: Clear differences between large/small/specialist
- **Engagement**: Executives want to keep chatting to understand members
- **Insight generation**: "I never thought about it that way" moments

## Risk Mitigation

### Technical Risks
- **Data quality**: Some societies may have limited online presence
  - *Mitigation*: Focus on major societies first, use BSA directory as fallback
- **API rate limits**: Trustpilot/website scraping restrictions
  - *Mitigation*: Respectful scraping, caching, manual backup for key data
- **Token costs**: Large knowledge base → expensive API calls  
  - *Mitigation*: Smart knowledge filtering, summarization pre-processing

### Content Risks
- **Stereotype concerns**: Personas too reductive or offensive
  - *Mitigation*: Diverse archetypes, authentic details, avoid caricature
- **Society sensitivity**: Real societies may object to portrayal
  - *Mitigation*: Focus on public information, respectful representation
- **Accuracy issues**: Outdated or wrong information
  - *Mitigation*: Regular data updates, clear "simulation" disclaimers

### Demo Risks
- **Technical failure**: API issues during presentation
  - *Mitigation*: Local fallback responses, multiple test scenarios
- **Conversation quality**: AI responses feel artificial
  - *Mitigation*: Extensive testing, prompt refinement, backup examples
- **Audience engagement**: Too complex or boring
  - *Mitigation*: Clear value proposition, interactive elements

## Success Definition

### Minimum Viable Demo
- 10 societies selectable ✅
- 4 persona archetypes working ✅
- Society-specific knowledge loading ✅
- Two-step selection UI ✅
- Mobile-friendly interface ✅

### Stretch Goals
- Society comparison mode
- Persona development over time
- Integration with real society data APIs
- Multi-language support (Welsh for Welsh societies)

---

**Total Estimated Effort**: 12-18 hours across 2-3 days
**Budget Impact**: $30-60 for scraping, minimal ongoing costs
**Risk Level**: Medium (mostly implementation risk, low content risk)

**Next Step**: Await Sam's approval to begin implementation, starting with society data collection and persona template creation.