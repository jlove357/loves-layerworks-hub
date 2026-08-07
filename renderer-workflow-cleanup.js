(() => {
  function finalizeWorkflowLayout() {
    const palettePanel = $('#palette-panel');
    const paletteAssistant = $('#paletteAssistant');
    if (palettePanel && paletteAssistant && paletteAssistant.parentElement !== palettePanel) {
      palettePanel.replaceChildren(paletteAssistant);
    }

    const badge = document.querySelector('.badge');
    if (badge) {
      badge.querySelector('b').textContent = 'V2.1';
      const badgeText = [...badge.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
      if (badgeText) badgeText.textContent = ' PF2 Storage & Integrity';
    }
    const footerLead = document.querySelector('footer span:first-child');
    if (footerLead) {
      footerLead.replaceChildren(createTextElement('b', '', 'V2.1 PF2:'), document.createTextNode(' Storage Management & Integrity'));
    }
  }

  finalizeWorkflowLayout();
})();
