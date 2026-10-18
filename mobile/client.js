(() => {
  const $ = selector => document.querySelector(selector);
  const status = $('#share-status');
  let watch = null, controller = null, generation = 0;
  function stop() {
    generation++;
    if (watch !== null) navigator.geolocation.clearWatch(watch);
    watch = null;
    controller?.abort();
    controller = null;
    $('#start').disabled = false;
    $('#stop').disabled = true;
    status.textContent = 'GPS-deling er stoppet. Ingen nye positioner sendes.';
  }
  $('#stop').onclick = stop;
  window.addEventListener('pagehide', stop);
  $('#share').onsubmit = async event => {
    event.preventDefault();
    if (watch !== null || $('#start').disabled || !$('#share-consent').checked) return;
    if (!window.isSecureContext || !navigator.geolocation) {
      status.textContent = 'GPS kræver HTTPS og en browser med lokationsadgang.';
      return;
    }
    const device = $('#phone-device').value.trim();
    const token = $('#phone-token').value.replace(/\s/g, '');
    if (!device || !token) return;
    $('#phone-token').value = token;
    $('#start').disabled = true;
    $('#stop').disabled = false;
    const current = ++generation;
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
    status.textContent = 'Kontrollerer enhedskode og nøgle…';
    try {
      controller = new AbortController();
      const response = await fetch('/device-auth', { method: 'POST', headers, signal: controller.signal, body: JSON.stringify({ device_name: device }) });
      if (current !== generation) return;
      if (!response.ok) {
        stop();
        status.textContent = response.status === 401
          ? 'Enhedskode og nøgle passer ikke sammen. Brug enhedsnøglen til dette nummer, ikke administratornøglen.'
          : 'Serverfejl ved kontrol af adgang. Prøv igen.';
        return;
      }
    } catch {
      if (current === generation) { stop(); status.textContent = 'Kunne ikke kontrollere adgang. Kontrollér internetforbindelsen.'; }
      return;
    }
    status.textContent = 'Adgang godkendt. Venter på din lokationstilladelse…';
    let lastSent = 0, sending = false;
    try {
      watch = navigator.geolocation.watchPosition(async position => {
        if (current !== generation || sending || Date.now() - lastSent < 5000) return;
        lastSent = Date.now();
        sending = true;
        controller = new AbortController();
        try {
          const coords = position.coords;
          const response = await fetch('/gps', {
            method: 'POST', headers, signal: controller.signal,
            body: JSON.stringify({ device_name: device, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, altitude: coords.altitude, speed: coords.speed }),
          });
          if (current !== generation) return;
          if (response.status === 401) { stop(); status.textContent = 'Enhedsadgang afvist. Deling stoppet.'; return; }
          if (!response.ok) throw Error('Server error');
          const result = await response.json();
          if (current !== generation) return;
          window.dispatchEvent(new CustomEvent('gps-position', { detail: result.location }));
          status.textContent = 'GPS-deling aktiv · position vist på kortet · senest sendt ' + new Date().toLocaleTimeString();
        } catch (error) {
          if (current === generation && error.name !== 'AbortError') status.textContent = 'Kunne ikke sende position. Kontrollér internetforbindelsen.';
        } finally { sending = false; }
      }, error => {
        if (current !== generation) return;
        if (error.code === 1) { stop(); status.textContent = 'Lokationsadgang afvist. Deling stoppet.'; }
        else status.textContent = error.code === 3 ? 'GPS-svar tog for lang tid; venter fortsat.' : 'Position utilgængelig; venter fortsat.';
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    } catch { stop(); status.textContent = 'Browseren kunne ikke starte GPS. Kontrollér lokationstilladelser.'; }
  };
})();
