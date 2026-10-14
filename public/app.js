let events = [];
let category = 'All';
const list = document.querySelector('#event-list');
function addText(parent, tag, value, className = '') {
  const node = document.createElement(tag);
  node.textContent = value;
  node.className = className;
  parent.append(node);
  return node;
}
function renderEvents() {
  list.replaceChildren();
  const upcoming = events.filter(event => Date.parse(event.start) > Date.now() && (category === 'All' || event.category === category));
  if (!upcoming.length) {
    const empty = document.createElement('div'); empty.className = 'event-empty';
    addText(empty, 'span', 'STAY IN THE LOOP', 'eyebrow');
    addText(empty, 'h3', events.length ? 'No upcoming events in this category.' : 'The next gathering is on the way.');
    addText(empty, 'p', 'Event dates will appear here when announced. Express interest to connect with the organizers.');
    const link = document.createElement('a'); link.href = '#join'; link.className = 'text-link'; link.textContent = 'Get involved ↗'; empty.append(link);
    list.append(empty); return;
  }
  for (const event of upcoming.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    const card = document.createElement('article'); card.className = 'event-card';
    addText(card, 'span', event.category, 'eyebrow');
    addText(card, 'h3', event.title);
    const date = addText(card, 'time', new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Chicago' }).format(new Date(event.start)) + ' (Central Time)');
    date.dateTime = event.start;
    addText(card, 'p', event.location, 'location'); addText(card, 'p', event.description);
    list.append(card);
  }
}
fetch('/api/events').then(async response => {
  if (!response.ok) throw new Error();
  events = (await response.json()).events; renderEvents();
}).catch(() => { list.replaceChildren(); addText(list, 'p', 'Event information could not be loaded. Please refresh the page.'); });
for (const button of document.querySelectorAll('[data-category]')) {
  button.addEventListener('click', () => {
    category = button.dataset.category;
    for (const option of document.querySelectorAll('[data-category]')) {
      const selected = option === button; option.classList.toggle('selected', selected); option.setAttribute('aria-pressed', String(selected));
    }
    renderEvents();
  });
}
for (const form of document.querySelectorAll('form[data-endpoint]')) {
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const button = form.querySelector('button[type=submit]'); const status = form.querySelector('.form-status');
    const fields = new FormData(form); const payload = Object.fromEntries(fields.entries());
    payload.consent = fields.get('consent') === 'on';
    button.disabled = true; status.classList.remove('error'); status.textContent = 'Submitting…';
    try {
      const response = await fetch(`/api/${form.dataset.endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit. Please try again.');
      status.textContent = result.message; form.reset();
    } catch (issue) { status.classList.add('error'); status.textContent = issue instanceof Error ? issue.message : 'Could not submit. Please try again.'; }
    finally { button.disabled = false; }
  });
}
