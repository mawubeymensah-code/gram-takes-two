export function validateEvents(events) {
  if (!Array.isArray(events)) throw new Error('Events must be an array.');
  return events.map(event => {
    if (!event || typeof event !== 'object') throw new Error('Invalid event.');
    for (const key of ['id', 'title', 'description', 'location', 'category', 'start']) {
      if (typeof event[key] !== 'string' || !event[key].trim() || event[key].length > 2000) throw new Error(`Invalid event ${key}.`);
    }
    if (!['Community', 'Service', 'Social'].includes(event.category)) throw new Error('Invalid event category.');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/.test(event.start) || Number.isNaN(Date.parse(event.start))) throw new Error('Event start needs a valid ISO timestamp with timezone.');
    return { id: event.id, title: event.title, description: event.description, location: event.location,
      category: event.category, start: event.start };
  });
}
