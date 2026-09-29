import type { QueryClassification } from '../../types/rag';

export function classifyQuery(query: string): { classification: QueryClassification; reason: string } {
  const q = query.toLowerCase().trim();

  // 1. WEATHER (Current observations, forecast, temperature now, wind, current rain)
  const weatherKeywords = [
    'weather', 'temperature', 'temp now', 'forecast', 'wind speed',
    'humidity now', 'will it rain', 'is it raining', 'current rain', 'degrees', 'celsius',
    'precipitation now', 'current conditions', 'today forecast', 'tomorrow forecast'
  ];
  if (weatherKeywords.some((kw) => q.includes(kw)) && !q.includes('risk') && !q.includes('protocol') && !q.includes('safety') && !q.includes('kit') && !q.includes('preparedness')) {
    return { classification: 'WEATHER', reason: 'Query inquires about real-time or short-term meteorological forecast conditions.' };
  }

  // 2. CLIMATE (Historical comparisons, long term trends, anomalies, baseline, past month)
  const climateKeywords = [
    'climate', 'historical', 'unusual rainfall', 'normal baseline', 'past 30 days',
    'climate trend', 'hotter than usual', 'rainfall anomaly', 'era5', 'reanalysis', 'historical baseline'
  ];
  if (climateKeywords.some((kw) => q.includes(kw))) {
    return { classification: 'CLIMATE', reason: 'Query inquires about long-term statistical trends and historical climate baselines.' };
  }

  // 3. RISK (Impact risk, flood risk, risk score, vulnerability, waterlogging danger)
  const riskKeywords = [
    'flood risk', 'risk score', 'risk level', 'hazard risk', 'waterlogging risk',
    'is there risk', 'why is risk', 'impact risk', 'danger of flood'
  ];
  if (riskKeywords.some((kw) => q.includes(kw))) {
    return { classification: 'RISK', reason: 'Query inquires about computed disaster and hydrological risk scores.' };
  }

  // 4. ALERT (Active warnings, system alerts, advisory feed, early warning, warning status)
  const alertKeywords = [
    'active alert', 'active warning', 'warning level', 'emergency alert',
    'system alert', 'early warning status', 'any alerts', 'imd alert', 'red alert', 'orange alert'
  ];
  if (alertKeywords.some((kw) => q.includes(kw)) && (q.includes('active') || q.includes('status') || q.includes('current'))) {
    return { classification: 'ALERT', reason: 'Query inquires about live early warning advisories and active alert statuses.' };
  }

  // 5. RAG (Preparedness, safety protocols, guidelines, survival kit, definitions, checklists, evacuations)
  const ragKeywords = [
    'what should i do', 'how to prepare', 'preparedness', 'safety', 'guidelines',
    'cyclone', 'flood safety', 'heatwave', 'survival kit', 'emergency kit', 'what does humidity mean',
    'what is dew point', 'rainfall classification', 'colour code', 'color code', 'do and don\'t',
    'evacuation', 'first aid', 'ndma', 'imd definition', 'meaning of'
  ];
  if (ragKeywords.some((kw) => q.includes(kw))) {
    return { classification: 'RAG', reason: 'Query matches authoritative disaster preparedness protocols, meteorological terminology, or safety guidelines.' };
  }

  // Default: if it asks about flood, heat, cyclone, or rain actions, route to RAG
  if (q.includes('flood') || q.includes('cyclone') || q.includes('storm') || q.includes('heat') || q.includes('rain')) {
    return { classification: 'RAG', reason: 'Query relates to hazard preparedness and requires grounded knowledge retrieval.' };
  }

  return { classification: 'GENERAL', reason: 'General weather intelligence or conversational inquiry.' };
}
