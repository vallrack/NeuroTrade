import { NextResponse } from 'next/server';
import { XMLParser } from 'fast-xml-parser';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Fetch fresh data every time

export async function GET() {
  try {
    const response = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.xml', {
      next: { revalidate: 300 } // Cache for 5 minutes
    });
    
    if (!response.ok) {
      throw new Error(`ForexFactory API respondió con estado ${response.status}`);
    }

    const xmlData = await response.text();
    const parser = new XMLParser();
    const result = parser.parse(xmlData);

    let events = [];
    if (result && result.weeklyevents && result.weeklyevents.event) {
      // Si solo hay un evento, fast-xml-parser lo devuelve como objeto, si hay varios como array
      events = Array.isArray(result.weeklyevents.event) 
        ? result.weeklyevents.event 
        : [result.weeklyevents.event];
    }

    // Filtrar, limpiar y calcular la fecha real
    const parsedEvents = events.map((ev: any) => {
      // Date y time vienen separados.
      // Ej: date="10-18-2024", time="8:30am" o "All Day"
      let parsedTime = ev.time || "All Day";
      let dateObj = null;
      
      try {
        if (parsedTime !== "All Day" && ev.date) {
          // El XML suele tener formato estandar EST (o dependiendo de cómo se consulte, pero asumimos EST/NY)
          // Crearemos un date local ingenuo solo para el frontend
          dateObj = new Date(`${ev.date} ${parsedTime}`);
        }
      } catch (e) {
        // Ignorar fechas inválidas
      }

      return {
        title: ev.title,
        country: ev.country,
        date: ev.date,
        time: ev.time,
        impact: ev.impact, // High, Medium, Low, Non-Economic
        forecast: ev.forecast || "",
        previous: ev.previous || "",
        dateObj: dateObj ? dateObj.toISOString() : null
      };
    });

    return NextResponse.json({
      success: true,
      events: parsedEvents
    });
  } catch (error: any) {
    console.error("Error fetching calendar:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Error desconocido al procesar el calendario"
    }, { status: 500 });
  }
}
