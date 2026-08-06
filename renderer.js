const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = [...document.querySelectorAll('[role="tabpanel"]')];

function activate(name, focus = false) {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    if (active && focus) tab.focus();
  });

  panels.forEach((panel) => {
    panel.hidden = panel.id !== `${name}-panel`;
  });

  const tab = tabs.find((item) => item.dataset.tab === name);
  document.querySelector('#pageTitle').textContent = tab?.dataset.title || 'Workspace';
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activate(tab.dataset.tab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    let next = index;
    if (event.key === 'ArrowDown') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    activate(tabs[next].dataset.tab, true);
  });
});

document.querySelector('#appName').textContent = window.layerWorks?.appName || "Love's LayerWorks Hub";
document.querySelector('#milestone').textContent = window.layerWorks?.milestone || 'M0';
activate('inventory');
