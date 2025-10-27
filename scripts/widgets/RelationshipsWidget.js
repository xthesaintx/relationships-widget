// RelationshipsWidget.js - Relationships Widget for FoundryVTT
export function createRelationshipsWidget(CampaignCodexWidget) {
  class RelationshipsWidget extends CampaignCodexWidget {
    constructor(widgetId, initialData, document) {
      super(widgetId, initialData, document);
      this.widgetData = null;
    }

    async render() {
      // Always load the latest data from document flags
      this.widgetData = (await this.getData()) || { actors: [] };
      const actors = Array.isArray(this.widgetData.actors) ? this.widgetData.actors : [];
      const isGM = typeof game !== 'undefined' && game.user && game.user.isGM;
      return `
        <div class="cc-widget relationships-widget">
          ${isGM ? `
            <div class="widget-controls">
              <button type="button" class="add-actor"><i class="fas fa-user-plus"></i> Add Actor</button>
              <button type="button" class="add-custom-relationship"><i class="fas fa-plus"></i> Add Custom</button>
            </div>
          ` : ''}
          <div class="relationships-list">
            ${actors.map(actor => this._renderActorRow(actor)).join('')}
          </div>
        </div>
      `;
    }

    _renderActorRow(actor) {
      const value = actor.value || 0;
      // Render hearts/skulls in a single row, left-aligned
      function renderIconsRow(icon, count) {
        if (count <= 0) return '';
        const max = 14;
        const limited = Math.min(count, max);
        return `<span class="relationship-iconsRowR" style="display: flex; flex-direction: row; gap: 2px;">${Array(limited).fill(`<span class='relationship-iconR'>${icon}</span>`).join('')}</span>` + (count > max ? `<span style='margin-left:4px;font-weight:bold;'>+${count-max}</span>` : '');
      }
      const hearts = value > 0 ? renderIconsRow('❤️', value) : '';
      const skulls = value < 0 ? renderIconsRow('💀', -value) : '';
      const isGM = typeof game !== 'undefined' && game.user && game.user.isGM;
      // Try to get the actor's image from the world, fallback to actor.img if present
let img = actor.img;
if (!img && actor.uuid && typeof game !== 'undefined' && game.actors) {
  const found = game.actors.get(actor.uuid) || (typeof fromUuid === 'function' ? game.actors.contents.find(a => a.uuid === actor.uuid) : null);
  if (found && found.img) img = found.img;
}
img = img || 'icons/svg/mystery-man.svg';
      // Add data-name for custom relationships (no uuid)
      const dataAttrs = actor.uuid ? `data-uuid="${actor.uuid}"` : `data-name="${encodeURIComponent(actor.name)}"`;
      return `
        <div class="relationship-rowR" ${dataAttrs} style="display: flex; align-items: flex-start; gap: 16px;">
          <div class="relationship-actorR">
            <img class="relationship-actor-imageR" src="${img}" alt="" />
            <div class="relationship-actor-nameR">${actor.name}</div>
          </div>
          <div class="relationship-iconsAndButtonsR" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; flex: 1;">
            <span class="relationship-iconsR" style="display: flex; align-items: center; gap: 2px; justify-content: flex-start; flex-direction: row;">${skulls}${value === 0 ? '0' : ''}${hearts}</span>
            ${isGM ? `
              <div class="relationship-buttonsR" style="display: flex; gap: 8px; margin-top: 4px;">
                <button type="button" class="relationship-decreaseR" title="Decrease">-</button>
                <button type="button" class="relationship-increaseR" title="Increase">+</button>
                <button type="button" class="relationship-removeR" title="Remove">🗑️</button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    async activateListeners(htmlElement) {
      super.activateListeners(htmlElement);
      // Always reload widgetData from document flags
      this.widgetData = (await this.getData()) || { actors: [] };
      htmlElement.querySelector('.add-actor')?.addEventListener('click', this._onAddActor.bind(this));
          htmlElement.querySelector('.add-custom-relationship')?.addEventListener('click', this._onAddCustom.bind(this));
      htmlElement.querySelectorAll('.relationship-rowR').forEach(row => {
        const uuid = row.dataset.uuid;
        const name = row.dataset.name ? decodeURIComponent(row.dataset.name) : undefined;
        const btnInc = row.querySelector('.relationship-increaseR');
        if (btnInc) btnInc.addEventListener('click', () => this._changeValue(uuid, 1, name));
        const btnDec = row.querySelector('.relationship-decreaseR');
        if (btnDec) btnDec.addEventListener('click', () => this._changeValue(uuid, -1, name));
        const btnRem = row.querySelector('.relationship-removeR');
        if (btnRem) btnRem.addEventListener('click', () => this._removeActor(uuid, name));
      });
      // Drag-and-drop support removed as requested
    }

    async _onAddActor() {
      // Always reload widgetData from document flags
      this.widgetData = (await this.getData()) || { actors: [] };
      // Allow all actor types (PCs, NPCs, etc.)
      const actors = game.actors.contents.filter(a => !this.widgetData.actors.some(e => e.uuid === a.uuid));
      console.log('[RelationshipsWidget] _onAddActor: available actors:', actors.map(a => a.name));
      if (actors.length === 0) {
        ui.notifications.warn('No available actors to add.');
        return;
      }
      const options = actors.map(a => `<option value=\"${a.uuid}\">${a.name}</option>`).join('');
      const content = `<form><label>Select Actor:</label><select name=\"actor\">${options}</select></form>`;
      new Dialog({
        title: 'Add Actor',
        content,
        buttons: {
          add: {
            label: 'Add',
            callback: async (html) => {
              // Always reload widgetData from document flags before modifying
              this.widgetData = (await this.getData()) || { actors: [] };
              const uuid = html.find('select[name="actor"]').val();
              let actor = game.actors.get(uuid);
              if (!actor && typeof fromUuid === 'function') {
                try {
                  actor = await fromUuid(uuid);
                  console.log('[RelationshipsWidget] fromUuid fallback result:', actor);
                } catch (e) {
                  console.log('[RelationshipsWidget] fromUuid error:', e);
                }
              }
              console.log('[RelationshipsWidget] Add Actor callback: selected uuid', uuid, 'actor', actor);
              if (actor && !this.widgetData.actors.some(e => e.uuid === uuid)) {
                this.widgetData.actors.push({ uuid, name: actor.name, value: 0 });
                await this.saveData(this.widgetData);
                console.log('[RelationshipsWidget] Actor added and data saved:', this.widgetData.actors);
                this.renderWidget();
              } else {
                console.log('[RelationshipsWidget] Actor not added (duplicate or not found)');
              }
            }
          },
          cancel: { label: 'Cancel' }
        },
        default: 'add'
      }).render(true);
    }
async _onAddCustom() {
  // Dialog for custom relationship: name and image
  const content = `
    <form>
      <div style="margin-bottom:0.5em;">
        <label>Name:</label><br>
        <input type="text" name="custom-name" style="width:100%" required />
      </div>
      <div>
        <label>Image URL:</label><br>
        <div style="display:flex;gap:0.5em;align-items:center;">
          <input type="text" name="custom-img" style="width:100%" placeholder="icons/svg/mystery-man.svg" />
          <button type="button" class="file-picker-btn" tabindex="-1" style="flex:0 0 auto;" title="Browse Files"><i class="fas fa-folder-open"></i></button>
        </div>
      </div>
    </form>
  `;
  const dlg = new Dialog({
    title: 'Add Custom Relationship',
    content,
    buttons: {
      add: {
        label: 'Add',
        callback: async (html) => {
          this.widgetData = (await this.getData()) || { actors: [] };
          const name = html.find('input[name="custom-name"]').val()?.trim();
          const img = html.find('input[name="custom-img"]').val()?.trim() || '';
          if (name && !this.widgetData.actors.some(e => e.name === name && !e.uuid)) {
            this.widgetData.actors.push({ name, img, value: 0 });
            await this.saveData(this.widgetData);
            this.renderWidget();
          }
        }
      },
      cancel: { label: 'Cancel' }
    },
    default: 'add',
    render: (html) => {
      // FilePicker integration for Foundry VTT v13+
      const btn = html.find('.file-picker-btn');
      btn.on('click', async (ev) => {
        ev.preventDefault();
        const input = html.find('input[name="custom-img"]');
        const fp = new foundry.applications.apps.FilePicker.implementation({
          type: 'image',
          callback: (path) => {
            input.val(path);
          }
        });
        fp.browse();
      });
    }
  });
  dlg.render(true);
}

    async _changeValue(uuid, delta, name) {
      let actor;
      if (uuid) {
        actor = this.widgetData.actors.find(a => a.uuid === uuid);
      } else if (name) {
        actor = this.widgetData.actors.find(a => !a.uuid && a.name === name);
      }
  if (!actor) return;
  const max = 14;
  const min = -14;
  let newValue = (actor.value || 0) + delta;
  if (newValue > max) newValue = max;
  if (newValue < min) newValue = min;
  actor.value = newValue;
  await this.saveData(this.widgetData);
  this.renderWidget();
    }


    async _removeActor(uuid, name) {
      if (uuid) {
        this.widgetData.actors = this.widgetData.actors.filter(a => a.uuid !== uuid);
      } else if (name) {
        this.widgetData.actors = this.widgetData.actors.filter(a => !(a.name === name && !a.uuid));
      }
      await this.saveData(this.widgetData);
      this.renderWidget();
    }

    async renderWidget() {
      // Helper to re-render the widget in place
      const container = document.querySelector(`#widget-${this.widgetId}`);
      if (container) {
        const html = await this.render();
        console.log('[RelationshipsWidget] renderWidget: rendering to', container, 'html:', html);
        container.innerHTML = html;
        this.activateListeners(container);
      } else {
        console.log('[RelationshipsWidget] renderWidget: container not found for', `#widget-${this.widgetId}`);
      }
    }
  }
  return RelationshipsWidget;
}
