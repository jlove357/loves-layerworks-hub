(() => {
  function finalizeWorkflowLayout() {
    const palettePanel = $('#palette-panel');
    const paletteAssistant = $('#paletteAssistant');
    if (palettePanel && paletteAssistant && paletteAssistant.parentElement !== palettePanel) {
      palettePanel.replaceChildren(paletteAssistant);
    }

    const badge = document.querySelector('.badge');
    if (badge) {
      badge.querySelector('b').textContent = 'V2';
      const badgeText = [...badge.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
      if (badgeText) badgeText.textContent = ' Workflow Cleanup';
    }
    const footerLead = document.querySelector('footer span:first-child');
    if (footerLead) {
      footerLead.replaceChildren(createTextElement('b', '', 'V2:'), document.createTextNode(' Workflow Cleanup'));
    }
  }

  finalizeWorkflowLayout();
})();
