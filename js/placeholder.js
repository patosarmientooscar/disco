// Huecos (css/placeholder.css): pone el ratio y el rótulo "FALTA FOTO · 4:5" + el archivo que va ahí.
// Solo toca las .ph vacías (las que ya tienen <img>/<video> solo reciben su ratio).
export function initPlaceholders(root = document) {
  root.querySelectorAll('.ph').forEach((ph) => {
    const ratio = ph.dataset.ratio || '4/5';
    ph.style.setProperty('--ph-ratio', ratio.replace('/', ' / '));
    if (ph.children.length) return;
    const video = ph.dataset.kind === 'video';
    const label = ph.dataset.label || `FALTA ${video ? 'VÍDEO' : 'FOTO'} · ${ratio.replace('/', ':')}`;
    ph.setAttribute('role', 'img');
    ph.setAttribute('aria-label', `${label} (pendiente)`);
    ph.innerHTML = `<i class="ph__c ph__c--tl"></i><i class="ph__c ph__c--tr"></i><i class="ph__c ph__c--bl"></i><i class="ph__c ph__c--br"></i>
      <span class="ph__label" aria-hidden="true"><span>${video ? '<i class="ph__rec"></i>' : ''}${label}</span>${ph.dataset.ph ? `<span class="ph__file">${ph.dataset.ph}</span>` : ''}</span>`;
  });
}
