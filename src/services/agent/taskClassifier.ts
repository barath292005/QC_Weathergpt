import type { AgentIntent, AgentChatMessage } from '../../types/agent';

export class TaskClassifier {
  public static classify(message: string, history?: AgentChatMessage[]): { intent: AgentIntent; reason: string } {
    const q = message.toLowerCase().trim();

    // 1. What-If Simulation
    if (
      q.includes('what if') ||
      q.includes('what happens if') ||
      q.includes('scenario') ||
      q.includes('if rainfall reaches') ||
      q.includes('if it rains')
    ) {
      return {
        intent: 'WHAT_IF',
        reason: 'User is proposing a hypothetical weather or precipitation scenario.',
      };
    }

    // 2. Geospatial Map
    if (
      q.includes('show on map') ||
      q.includes('view map') ||
      q.includes('map view') ||
      q.includes('show location') ||
      q.includes('map marker') ||
      q.includes('coordinates') ||
      (q.includes('show') && q.includes('map'))
    ) {
      return {
        intent: 'MAP',
        reason: 'User is asking for geographic or spatial visualization of coordinates/hazard.',
      };
    }

    // 3. Conversational Context Resolution: pronouns referring to prior turns
    if (history && history.length > 0) {
      const lastAssistantMsg = [...history].reverse().find((m) => m.role === 'assistant');
      if (
        q.includes('is that dangerous') ||
        q.includes('will that cause flood') ||
        q.includes('will it be dangerous') ||
        q.includes('is there danger') ||
        q.includes('could that cause waterlogging')
      ) {
        return {
          intent: 'RISK',
          reason: 'Pronoun resolved from prior conversation turn into flood impact risk inquiry.',
        };
      }
      if (q.includes('what should i do about that') || q.includes('how to prepare for that')) {
        return {
          intent: 'RAG',
          reason: 'Pronoun resolved into safety & preparedness guidance.',
        };
      }
    }

    // 4. Alerts & Early Warnings
    if (
      q.includes('alert') ||
      q.includes('warning') ||
      q.includes('advisory') ||
      q.includes('active alerts') ||
      q.includes('early warning') ||
      q.includes('red alert') ||
      q.includes('orange alert')
    ) {
      if (q.includes('what is') || q.includes('explain') || q.includes('colour code') || q.includes('matrix')) {
        return {
          intent: 'RAG',
          reason: 'Query asks for definition/glossary explanation of warning codes.',
        };
      }
      return {
        intent: 'ALERT',
        reason: 'Query inquires about live early warning advisories and active alert statuses.',
      };
    }

    // 5. Impact-Based Risk
    if (
      q.includes('risk') ||
      q.includes('flood risk') ||
      q.includes('waterlogging') ||
      q.includes('inundation') ||
      q.includes('danger') ||
      q.includes('impact score') ||
      q.includes('why is risk')
    ) {
      if (q.includes('how to prepare') || q.includes('what should i do') || q.includes('safety')) {
        return {
          intent: 'RAG',
          reason: 'Query asks for authoritative disaster safety and preparedness steps.',
        };
      }
      return {
        intent: 'RISK',
        reason: 'Query inquires about computed disaster and hydrological risk scores.',
      };
    }

    // 6. Historical Climate
    if (
      q.includes('climate') ||
      q.includes('historical') ||
      q.includes('unusual') ||
      q.includes('baseline') ||
      q.includes('anomaly') ||
      q.includes('era5') ||
      q.includes('past 30 days') ||
      q.includes('past month')
    ) {
      return {
        intent: 'CLIMATE',
        reason: 'Query inquires about long-term statistical trends and historical climate baselines.',
      };
    }

    // 7. RAG Knowledge / Safety / Preparedness
    if (
      q.includes('what should i do') ||
      q.includes('how to prepare') ||
      q.includes('safety') ||
      q.includes('survival kit') ||
      q.includes('emergency kit') ||
      q.includes('cyclone checklist') ||
      q.includes('heatwave precaution') ||
      q.includes('what does humidity mean') ||
      q.includes('what is dew point') ||
      q.includes('first aid') ||
      q.includes('evacuation rule') ||
      q.includes('ndma') ||
      q.includes('sop')
    ) {
      return {
        intent: 'RAG',
        reason: 'Query matches authoritative disaster preparedness protocols, meteorological terminology, or safety guidelines.',
      };
    }

    // 8. Real-Time Weather
    if (
      q.includes('weather') ||
      q.includes('temperature') ||
      q.includes('rain today') ||
      q.includes('rain tomorrow') ||
      q.includes('forecast') ||
      q.includes('wind') ||
      q.includes('humidity') ||
      q.includes('is it raining') ||
      q.includes('will it rain')
    ) {
      return {
        intent: 'WEATHER',
        reason: 'Query inquires about real-time or short-term meteorological forecast conditions.',
      };
    }

    return {
      intent: 'GENERAL',
      reason: 'General inquiry or conversational interaction.',
    };
  }
}
