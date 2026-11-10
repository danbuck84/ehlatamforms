import type { Level, Rating, Speaking } from '../../../shared/constants';

export type TopicClusterId =
  | 'tech_career'
  | 'culture_food_travel'
  | 'hobbies_icebreaker'
  | 'confidence_fluency'
  | 'other_topic';

export type ImprovementCategoryId =
  | 'leveling_beginners'
  | 'duration_time'
  | 'dynamics_structure'
  | 'questions_requests';

export interface TopicClusterMeta {
  id: TopicClusterId;
  icon: string;
  title: string;
  subtitle: string;
}

export interface ImprovementCategoryMeta {
  id: ImprovementCategoryId;
  icon: string;
  title: string;
  subtitle: string;
}

export const TOPIC_CLUSTERS: readonly TopicClusterMeta[] = [
  {
    id: 'tech_career',
    icon: '💻',
    title: 'Tech, Career & Dev Routine',
    subtitle: 'Daily, review, job interviews, remote work, AI & tech market',
  },
  {
    id: 'culture_food_travel',
    icon: '🌎',
    title: 'Food, Culture & Travel',
    subtitle: 'Local dishes, LATAM countries, traditions, places & trips',
  },
  {
    id: 'hobbies_icebreaker',
    icon: '🤝',
    title: 'Free Talk, Hobbies & Getting to Know Each Other',
    subtitle: 'Icebreakers, routine, movies, music, games & open conversation',
  },
  {
    id: 'confidence_fluency',
    icon: '🗣️',
    title: 'Speaking Confidence & Practical English',
    subtitle: 'Overcoming shyness, public speaking, vocabulary & grammar tips',
  },
  {
    id: 'other_topic',
    icon: '📌',
    title: 'Other Specific Topics',
    subtitle: 'Custom themes suggested by students',
  },
] as const;

export const IMPROVEMENT_CATEGORIES: readonly ImprovementCategoryMeta[] = [
  {
    id: 'leveling_beginners',
    icon: '🛟',
    title: 'Leveling & Beginner Support',
    subtitle: 'Requests for level split, beginner material, or difficulty keeping up',
  },
  {
    id: 'duration_time',
    icon: '⏱️',
    title: 'Class Duration & Breakout Time',
    subtitle: 'Requests for longer classes (+30 min) or more time in dynamics',
  },
  {
    id: 'dynamics_structure',
    icon: '🎯',
    title: 'Room Dynamics & Class Format',
    subtitle: 'Suggestions on group size, prompts, guided questions, or pacing',
  },
  {
    id: 'questions_requests',
    icon: '❓',
    title: 'Direct Questions & Other Suggestions',
    subtitle: 'Specific questions, course recommendations, or general suggestions',
  },
] as const;

export interface FeedbackCheckinInput {
  id: string;
  sessionId: string;
  email: string;
  country: string;
  speaking: Speaking;
  level: Level | null;
  rating: Rating;
  comment: string | null;
  topicSuggestion: string | null;
  isTeacher: boolean;
}

export interface EnrichedFeedbackItem {
  checkin: FeedbackCheckinInput;
  topicClusters: TopicClusterId[];
  improvementCategories: ImprovementCategoryId[];
  isPraiseOnly: boolean;
  isActionable: boolean;
}

export interface TopicClusterStat extends TopicClusterMeta {
  count: number;
  pct: number;
  samples: string[];
}

export interface ImprovementCategoryStat extends ImprovementCategoryMeta {
  count: number;
  pct: number;
  samples: string[];
}

export interface FeedbackRadarSummary {
  totalStudentCheckins: number;
  withTopicCount: number;
  withCommentCount: number;
  actionableImprovementCount: number;
  praiseOnlyCount: number;
  topicClusters: TopicClusterStat[];
  improvementCategories: ImprovementCategoryStat[];
  topKeywords: Array<{ word: string; count: number }>;
  items: EnrichedFeedbackItem[];
}

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const TOPIC_PATTERNS: Record<Exclude<TopicClusterId, 'other_topic'>, RegExp> = {
  tech_career:
    /\b(tech|tecnolog\w*|market|mercado|daily|dailies|review|sprint|scrum|agile|meeting\w*|reuniao|reunioes|reunion\w*|interview\w*|entrevista\w*|job\w*|work\w*|trabalh\w*|trabajo|career\w*|carreira\w*|carrera|dev\w*|program\w*|code|codigo|coding|software|ai|ia|inteligencia artificial|linkedin|resume|curriculo|cv|remote|remoto|salary|salario|layoff\w*|startup\w*|deploy|bug\w*)\b/,
  culture_food_travel:
    /\b(food\w*|comida\w*|culinari\w*|cook\w*|cozinha\w*|cocina\w*|dish\w*|prato\w*|plato\w*|restaurante\w*|cultur\w*|travel\w*|viagem|viagens|viajar|viaje\w*|trip\w*|countr\w*|pais|paises|latam|latin\w*|city|cities|cidade\w*|ciudad\w*|tradition\w*|tradicao|tradicion\w*|place\w*|lugar\w*|turism\w*|tourism|world|globe|mundo)\b/,
  hobbies_icebreaker:
    /\b(hobb\w*|free topic\w*|tema livre|temas livres|tema libre|conhecer|get to know|know people|conocer|icebreaker\w*|quebra-gelo|music\w*|movie\w*|filme\w*|pelicula\w*|serie\w*|game\w*|jogo\w*|juego\w*|sport\w*|esporte\w*|deporte\w*|book\w*|livro\w*|libro\w*|routine|rotina|rutina|weekend\w*|fim de semana|pet\w*|animal\w*|amigo\w*|friend\w*|family|familia)\b/,
  confidence_fluency:
    /\b(shy\w*|timid\w*|vergonha|vergüenza|fear|medo|miedo|uncomfortable|incomod\w*|desconfort\w*|nervous|nervos\w*|public|publico|overcome|superar|destravar|confiden\w*|confianc\w*|confianza|pronunc\w*|grammar|gramatica|vocabular\w*|fluenc\w*|fluent\w*|iniciante\w*|beginner\w*|principiante\w*|slang\w*|giria\w*|idiom\w*|phrasal)\b/,
};

const IMPROVEMENT_PATTERNS: Record<ImprovementCategoryId, RegExp> = {
  leveling_beginners:
    /\b(nivel\w*|level\w*|iniciante\w*|beginner\w*|basic\w*|basico|analfabet\w*|nao consigo|nao entendi|dificil|dificuldade|hard|lost|perdid\w*|travad\w*|accompagn\w*|acompanhar|separar por nivel|dividir por nivel|curso|indicacao|indicar)\b/,
  duration_time:
    /\b(tempo|time|minut\w*|hora\w*|hour\w*|maior\w*|mais longa\w*|longer|more time|mais tempo|mas tiempo|curt\w*|short|30 min\w*|1h30|pouco tempo|poco tiempo|dar tempo|extend\w*)\b/,
  dynamics_structure:
    /\b(dinamica\w*|dynamic\w*|breakout\w*|breakroom\w*|grupo\w*|group\w*|room\w*|sala\w*|formato|format|modelo|model|pergunta\w*|question\w*|roteiro|script|topico\w*|menor\w*|smaller|pair\w*|dupla\w*)\b/,
  questions_requests:
    /\b(sugest\w*|suggest\w*|sugerenc\w*|seria bom|seria muito bom|seria legal|poderia\w*|could|would be nice|would be great|talvez|maybe|quizas|duvida\w*|doubt\w*|pergunta|question|como faco|onde|when|quando|\?)\b/,
};

const CONTRAST_OR_REQUEST_SIGNAL =
  /\b(mas|porem|contudo|entretanto|but|however|although|pero|aunque|seria bom|seria muito bom|seria legal|poderia\w*|faltou|falta|melhor\w*|improv\w*|sugest\w*|suggest\w*|talvez|maybe|precis\w*|need\w*|ajudaria|help\w*|dificil|analfabet\w*|nivelamento|indicacao|\?)\b/;

const STOPWORDS = new Set([
  'the','and','for','that','this','with','from','have','would','like','about','what','today','class','classes','english','talk','speaking','people','really','very','much','more','some','into','just','they','them','their','there','were','been','hear','heard','think','know','good','great','amazing','awesome','enjoyed','love','time','spent','keep','work',
  'que','para','com','uma','umas','uns','dos','das','nos','nas','por','mais','muito','muita','como','sobre','aula','aulas','hoje','falar','conversar','ingles','grupo','pessoal','alunos','aluno','outros','outras','seria','bom','boa','bem','foi','esta','estao','meu','minha','meus','minhas','ter','fazer','dar','tempo','todas','todos','tudo','onde','possamos','gostaria','gostei','adoro','experiencia','primeira','pelo','pela','isso','esse','essa','este','esta','tambem','talvez','pouco',
  'los','las','una','unos','unas','del','por','con','para','mas','muy','como','sobre','clase','clases','hablar','ingles','otros','otras','bueno','buena',
]);

export function classifyTopic(raw: string | null | undefined): TopicClusterId[] {
  const text = (raw ?? '').trim();
  if (!text) return [];
  const f = fold(text);
  const matched: TopicClusterId[] = [];
  for (const [id, regex] of Object.entries(TOPIC_PATTERNS) as Array<
    [Exclude<TopicClusterId, 'other_topic'>, RegExp]
  >) {
    if (regex.test(f)) matched.push(id);
  }
  return matched.length > 0 ? matched : ['other_topic'];
}

export function classifyComment(
  raw: string | null | undefined,
  level: Level | null,
  speaking: Speaking,
  rating: Rating,
): { categories: ImprovementCategoryId[]; isPraiseOnly: boolean; isActionable: boolean } {
  const text = (raw ?? '').trim();
  if (!text) {
    return { categories: [], isPraiseOnly: false, isActionable: false };
  }
  const f = fold(text);
  const categories = new Set<ImprovementCategoryId>();

  if (IMPROVEMENT_PATTERNS.leveling_beginners.test(f)) {
    categories.add('leveling_beginners');
  }
  if (IMPROVEMENT_PATTERNS.duration_time.test(f)) {
    categories.add('duration_time');
  }

  const hasRequestSignal =
    CONTRAST_OR_REQUEST_SIGNAL.test(f) ||
    rating <= 3 ||
    level === 'too_hard' ||
    speaking === 'listened';

  if (hasRequestSignal && IMPROVEMENT_PATTERNS.dynamics_structure.test(f)) {
    categories.add('dynamics_structure');
  }
  if (hasRequestSignal && IMPROVEMENT_PATTERNS.questions_requests.test(f) && categories.size === 0) {
    categories.add('questions_requests');
  }
  if (hasRequestSignal && categories.size === 0) {
    if (level === 'too_hard' || speaking === 'listened') {
      categories.add('leveling_beginners');
    } else {
      categories.add('questions_requests');
    }
  }

  const list = [...categories];
  const isActionable = list.length > 0;
  return {
    categories: list,
    isPraiseOnly: !isActionable,
    isActionable,
  };
}

export function buildFeedbackRadar(
  checkins: FeedbackCheckinInput[],
  sessionFilter: string | 'all' = 'all',
): FeedbackRadarSummary {
  const filtered = checkins.filter(
    (c) => !c.isTeacher && (sessionFilter === 'all' || c.sessionId === sessionFilter),
  );

  const topicMap = new Map<TopicClusterId, { count: number; samples: string[] }>();
  for (const c of TOPIC_CLUSTERS) topicMap.set(c.id, { count: 0, samples: [] });

  const impMap = new Map<ImprovementCategoryId, { count: number; samples: string[] }>();
  for (const c of IMPROVEMENT_CATEGORIES) impMap.set(c.id, { count: 0, samples: [] });

  const wordCounts = new Map<string, number>();
  const items: EnrichedFeedbackItem[] = [];

  let withTopicCount = 0;
  let withCommentCount = 0;
  let actionableImprovementCount = 0;
  let praiseOnlyCount = 0;

  for (const c of filtered) {
    const hasTopic = Boolean(c.topicSuggestion && c.topicSuggestion.trim());
    const hasComment = Boolean(c.comment && c.comment.trim());
    if (hasTopic) withTopicCount++;
    if (hasComment) withCommentCount++;

    const topicClusters = classifyTopic(c.topicSuggestion);
    for (const tid of topicClusters) {
      const entry = topicMap.get(tid)!;
      entry.count++;
      if (c.topicSuggestion && entry.samples.length < 3) {
        entry.samples.push(c.topicSuggestion.trim());
      }
    }

    const commentInfo = classifyComment(c.comment, c.level, c.speaking, c.rating);
    if (commentInfo.isActionable) actionableImprovementCount++;
    if (commentInfo.isPraiseOnly) praiseOnlyCount++;

    for (const iid of commentInfo.categories) {
      const entry = impMap.get(iid)!;
      entry.count++;
      if (c.comment && entry.samples.length < 3) {
        entry.samples.push(c.comment.trim());
      }
    }

    if (hasTopic && c.topicSuggestion) {
      const words = fold(c.topicSuggestion)
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
      const seenInDoc = new Set<string>();
      for (const w of words) {
        if (!seenInDoc.has(w)) {
          seenInDoc.add(w);
          wordCounts.set(w, (wordCounts.get(w) ?? 0) + 1);
        }
      }
    }

    if (hasTopic || hasComment) {
      items.push({
        checkin: c,
        topicClusters,
        improvementCategories: commentInfo.categories,
        isPraiseOnly: commentInfo.isPraiseOnly,
        isActionable: hasTopic || commentInfo.isActionable,
      });
    }
  }

  const topicDenom = Math.max(1, withTopicCount);
  const topicClusters: TopicClusterStat[] = TOPIC_CLUSTERS.map((meta) => {
    const st = topicMap.get(meta.id)!;
    return {
      ...meta,
      count: st.count,
      pct: withTopicCount > 0 ? Math.round((st.count / topicDenom) * 100) : 0,
      samples: st.samples,
    };
  }).sort((a, b) => b.count - a.count);

  const impDenom = Math.max(1, actionableImprovementCount);
  const improvementCategories: ImprovementCategoryStat[] = IMPROVEMENT_CATEGORIES.map((meta) => {
    const st = impMap.get(meta.id)!;
    return {
      ...meta,
      count: st.count,
      pct: actionableImprovementCount > 0 ? Math.round((st.count / impDenom) * 100) : 0,
      samples: st.samples,
    };
  }).sort((a, b) => b.count - a.count);

  const topKeywords = [...wordCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));

  return {
    totalStudentCheckins: filtered.length,
    withTopicCount,
    withCommentCount,
    actionableImprovementCount,
    praiseOnlyCount,
    topicClusters,
    improvementCategories,
    topKeywords,
    items,
  };
}
