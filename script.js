/**
 * LEGACY V10 - REFACTORED CORE
 * Melhorias: Código limpo, Toasts, Correção de Bugs, Renderização de Diário
 */

const CONFIG = {
    KEY: 'LegacyRPG_Data_V10',
    XP_BASE: 20,
    GOLD_BASE: 15,
    LEVEL_MULT: 100
};

// --- GERENCIADOR DE DADOS ---
const DataManager = {
    defaultState: {
        user: { 
            name: 'Operador', 
            class: 'novice', 
            lvl: 1, 
            avatar: 'https://cdn-icons-png.flaticon.com/512/149/149071.png', 
            email: null,
            password: null,
            age: null,
            weight: null,
            job: null,
            onboarding: false 
        },
        security: { pass: null },
        stats: { dis: 10, int: 10, str: 10, zel: 10 },
        wallet: { gold: 0, streak: 0, lastLogin: null },
        tasks: [], 
        journal: [],
        achievements: [], // Lista de IDs de conquistas desbloqueadas
        vision: [],
        skills: [],
        settings: { theme: 'cyber', hardcore: false, sound: true, animations: true }
    },

    load() {
        const raw = localStorage.getItem(CONFIG.KEY);
        if (!raw) return this.defaultState;
        
        // Merge profundo simples para garantir que novos campos do defaultState existam no save antigo
        const parsed = JSON.parse(raw);
        return { 
            ...this.defaultState, 
            ...parsed, 
            user: { ...this.defaultState.user, ...parsed.user },
            stats: { ...this.defaultState.stats, ...parsed.stats },
            settings: { ...this.defaultState.settings, ...parsed.settings }
        };
    },

    save(data) { 
        localStorage.setItem(CONFIG.KEY, JSON.stringify(data)); 
    },
    
    reset() { 
        UI.confirm("TEM CERTEZA? Todo o progresso será perdido.", () => {
            localStorage.removeItem(CONFIG.KEY); 
            location.reload(); 
        });
    }
};

// --- LÓGICA DO SISTEMA ---
const App = {
    data: null,

    // Definição das Conquistas
    achievementsList: [
        { id: 'lvl5', icon: 'fa-star', title: 'Ascensão', desc: 'Alcance o Nível 5', check: (d) => d.user.lvl >= 5 },
        { id: 'streak3', icon: 'fa-fire', title: 'Aquecimento', desc: 'Sequência de 3 dias', check: (d) => d.wallet.streak >= 3 },
        { id: 'streak10', icon: 'fa-fire-flame-curved', title: 'Imparável', desc: 'Sequência de 10 dias', check: (d) => d.wallet.streak >= 10 },
        { id: 'rich', icon: 'fa-coins', title: 'Magnata', desc: 'Tenha 1000 Gold', check: (d) => d.wallet.gold >= 1000 },
        { id: 'str50', icon: 'fa-dumbbell', title: 'Titã', desc: '50 de Força', check: (d) => d.stats.str >= 50 },
        { id: 'int50', icon: 'fa-brain', title: 'Sábio', desc: '50 de Inteligência', check: (d) => d.stats.int >= 50 },
        { id: 'dis50', icon: 'fa-briefcase', title: 'Mestre', desc: '50 de Disciplina', check: (d) => d.stats.dis >= 50 },
        { id: 'zel50', icon: 'fa-heart', title: 'Guardião', desc: '50 de Zelo', check: (d) => d.stats.zel >= 50 }
    ],

    init() {
        this.data = DataManager.load();
        
        // ROTEAMENTO DE TELAS (View Router)
        if(this.data.security.pass && this.data.user.onboarding) {
            // Tem senha e já tem cadastro -> Tela de Bloqueio
            UI.showView('view-lock');
        } else if(!this.data.user.onboarding) {
            // Não tem cadastro -> Tela de Setup
            UI.showView('view-setup');
        } else {
            // Tudo ok -> Entra no App
            UI.showView('view-app');
        }
        
        this.checkStreak();
        this.checkAchievements(); // Verifica conquistas ao carregar
        UI.render(this.data);
    },

    persist() { 
        DataManager.save(this.data); 
    },

    // --- AÇÕES DO USUÁRIO ---
    
    cheatGold() {
        this.data.wallet.gold += 1000;
        UI.toast("CHEAT: +1000 Gold", "success");
        this.persist();
        UI.render(this.data);
    },

    cheatXP() {
        // Adiciona stats suficientes para forçar um level up ou progresso
        this.data.stats.int += 50;
        this.data.stats.str += 50;
        UI.toast("CHEAT: +100 XP (Stats)", "success");
        this.checkLevel();
        this.checkAchievements();
        this.persist();
        UI.render(this.data);
    },

    completeOnboarding() {
        const name = document.getElementById('setup-name').value;
        const email = document.getElementById('setup-email').value;
        const pass = document.getElementById('setup-pass').value;
        const age = document.getElementById('setup-age').value;
        const weight = document.getElementById('setup-weight').value;
        const job = document.getElementById('setup-job').value;
        const theme = document.getElementById('setup-theme').value;
        const cls = StepSystem.selected;
        
        if(!name || !cls || !age || !weight || !job || !email || !pass) return UI.toast("Preencha todos os dados do perfil!", "error");
        
        this.data.user.name = name;
        this.data.user.email = email;
        this.data.user.password = pass; // Nota: Em produção real, senhas nunca devem ser salvas em texto puro
        this.data.user.class = cls;
        this.data.user.age = age;
        this.data.user.weight = weight;
        this.data.user.job = job;
        this.data.settings.theme = theme;
        
        // Bônus de Classe
        if(cls === 'guerreiro') this.data.stats.str += 20;
        if(cls === 'hacker') this.data.stats.int += 20;
        if(cls === 'atleta') { this.data.stats.str += 10; this.data.stats.dis += 10; }
        
        this.data.user.onboarding = true;
        
        // Tarefas Iniciais (Vazio conforme solicitado)
        this.data.tasks = [];
        
        UI.showView('view-app');
        this.persist();
        this.downloadUserData(); // Baixa o arquivo localmente simulando a criação de pasta
        UI.render(this.data);
        UI.toast(`Bem-vindo, ${cls} ${name}!`);
    },

    handleAddTask() {
        const desc = document.getElementById('new-task-desc').value;
        const type = document.getElementById('new-task-type').value;
        const context = document.getElementById('task-context').value;
        
        if(!desc) return UI.toast("Digite uma descrição!", "error");

        const newTask = {
            id: Date.now(),
            desc,
            type,
            mode: context,
            lastDoneDate: null
        };

        if(context === 'goal') {
            const days = parseInt(document.getElementById('new-task-days').value) || 10;
            newTask.daysTotal = days;
            newTask.daysCurrent = 0;
            newTask.finished = false;
        }

        this.data.tasks.push(newTask);
        this.persist();
        UI.toggleModal('add-modal', false);
        UI.render(this.data);
        UI.toast("Objetivo criado com sucesso!", "success");
    },

    completeTask(id) {
        const t = this.data.tasks.find(x => x.id === id);
        const today = new Date().toDateString();

        if(!t) return; 
        if(t.lastDoneDate === today) {
            return UI.toast("Já realizado hoje. Volte amanhã!", "error");
        }

        t.lastDoneDate = today;
        
        // Recompensas
        this.data.stats[t.type] += 10;
        this.data.wallet.gold += 15;
        UI.toast(`+10 ${t.type.toUpperCase()} | +15 Gold`, "success");

        // Lógica de Metas
        if(t.mode === 'goal') {
            t.daysCurrent++;
            if(t.daysCurrent >= t.daysTotal) {
                t.finished = true;
                this.data.stats[t.type] += 500;
                UI.toast(`META CONCLUÍDA! +500 XP`, "success");
                // Removemos a tarefa concluída para limpar a lista (opcional)
                // this.data.tasks = this.data.tasks.filter(x => x.id !== id);
            }
        }

        this.checkLevel();
        this.persist();
        this.checkAchievements();
        UI.render(this.data);
    },

    deleteTask(id) {
        UI.confirm("Excluir esta tarefa permanentemente?", () => {
            this.data.tasks = this.data.tasks.filter(t => t.id !== id);
            this.persist();
            UI.render(this.data);
            UI.toggleModal('delete-task-modal', false); // Fecha o modal e volta ao painel
            UI.toast("Tarefa removida.");
        });
    },

    checkLevel() {
        const total = Object.values(this.data.stats).reduce((a,b)=>a+b,0);
        const nextLvl = this.data.user.lvl * CONFIG.LEVEL_MULT;
        
        if(total >= nextLvl) {
            this.data.user.lvl++;
            UI.toast(`LEVEL UP! Nível ${this.data.user.lvl} alcançado!`, "success");
        }
    },

    checkStreak() {
        const today = new Date().toDateString();
        if(this.data.wallet.lastLogin !== today) {
            if(this.data.wallet.lastLogin) {
                const y = new Date(); y.setDate(y.getDate()-1);
                if(y.toDateString() === this.data.wallet.lastLogin) this.data.wallet.streak++;
                else this.data.wallet.streak = 1;
            } else this.data.wallet.streak = 1;
            
            this.data.wallet.lastLogin = today;
            this.persist();
        }
    },

    checkAchievements() {
        this.achievementsList.forEach(b => {
            // Se a condição for verdadeira E ainda não tiver a conquista
            if(b.check(this.data) && !this.data.achievements.includes(b.id)) {
                this.data.achievements.push(b.id);
                UI.toast(`🏆 Conquista Desbloqueada: ${b.title}`, "success");
                this.persist();
            }
        });
    },

    // --- SETTINGS & EXTRAS ---
    unlock() { 
        if(document.getElementById('unlock-pass').value === this.data.security.pass) {
            UI.showView('view-app');
        } else {
            UI.toast("Senha Incorreta", "error");
        }
    },
    
    updateSetting(key, value) {
        this.data.settings[key] = value;
        this.persist();
        UI.toast("Configuração salva");
    },

    setPassword(p) { 
        this.data.security.pass = p; 
        this.persist(); 
        UI.toast("Nova senha definida", "success"); 
    },
    
    addVisionItem() { 
        const u = document.getElementById('vision-url').value; 
        if(u) { 
            this.data.vision.push(u); 
            this.persist(); 
            UI.render(this.data); 
            document.getElementById('vision-url').value = '';
            UI.toggleModal('vision-add-modal', false);
        } 
    },

    uploadVision(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                App.data.vision.push(e.target.result);
                App.persist();
                UI.render(App.data);
                UI.toggleModal('vision-add-modal', false);
                UI.toast("Imagem da galeria adicionada!");
            };
            reader.readAsDataURL(input.files[0]);
        }
    },

    deleteVisionItem(idx) {
        UI.confirm("Remover esta imagem?", () => {
            this.data.vision.splice(idx, 1);
            this.persist();
            UI.render(this.data);
            UI.toast("Imagem removida.");
        });
    },
    
    updateAvatar() { 
        const u = document.getElementById('avatar-url-input').value; 
        if(u) { 
            this.data.user.avatar = u; 
            this.persist(); 
            UI.toggleModal('avatar-modal', false); 
            UI.render(this.data); 
        } 
    },

    uploadAvatar(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                App.data.user.avatar = e.target.result;
                App.persist();
                UI.toggleModal('avatar-modal', false);
                UI.render(App.data);
                UI.toast("Avatar atualizado!");
            };
            reader.readAsDataURL(input.files[0]);
        }
    },
    
    buySkill(id) { 
        if(this.data.wallet.gold >= 500 && !this.data.skills.includes(id)) { 
            this.data.wallet.gold -= 500; 
            this.data.skills.push(id); 
            this.persist(); 
            UI.render(this.data); 
            UI.toast("Habilidade Adquirida!", "success"); 
        } else {
            UI.toast("Gold insuficiente ou já possui.", "error");
        }
    },

    downloadUserData() {
        // Cria um arquivo JSON com os dados do usuário para download
        const fileName = `${this.data.user.name.replace(/\s+/g, '_')}_data.json`;
        const jsonStr = JSON.stringify(this.data, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
    },

    exportSave() {
        const str = btoa(JSON.stringify(this.data));
        navigator.clipboard.writeText(str).then(() => UI.toast("Save copiado para a área de transferência!", "success"));
    },

    importSave() {
        const str = prompt("Cole o código do seu Save aqui:");
        if(!str) return;
        try {
            const json = JSON.parse(atob(str));
            if(json.user && json.wallet) {
                DataManager.save(json);
                location.reload();
            } else {
                throw new Error("Formato inválido");
            }
        } catch(e) {
            UI.toast("Erro ao importar Save. Código inválido.", "error");
        }
    },

    deleteJournal(idx) {
        UI.confirm("Apagar este registro do diário?", () => {
            this.data.journal.splice(idx, 1);
            this.persist();
            UI.render(this.data);
            UI.toast("Registro apagado.");
        });
    }
};

// --- INTERFACE DO USUÁRIO ---
const UI = {
    chart: null,
    
    showView(viewId) {
        // Esconde todas as views e mostra só a desejada
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
    },

    render(d) {
        // Header Info
        document.getElementById('greeting-text').innerText = `Olá, ${d.user.name}`;
        document.getElementById('hud-gold').innerText = d.wallet.gold;
        document.getElementById('hud-streak').innerText = d.wallet.streak;
        
        // Sidebar Info
        document.getElementById('pc-name').innerText = d.user.name;
        document.getElementById('pc-lvl').innerText = "Lv."+d.user.lvl;
        document.getElementById('pc-class').innerText = d.user.class.toUpperCase();
        document.getElementById('pc-avatar').src = d.user.avatar;
        document.getElementById('mob-avatar').src = d.user.avatar;
        
        // Render Sidebar Stats Bars
        const statsDiv = document.getElementById('sidebar-stats');
        if(statsDiv) {
            // Se estiver vazio, cria a estrutura inicial
            if(statsDiv.children.length === 0) {
                statsDiv.innerHTML = Object.entries(d.stats).map(([key, val]) => `
                    <div class="stat-row" data-key="${key}">
                        <span class="stat-label">${key}</span>
                        <div class="stat-track"><div class="stat-fill" style="width: 0%"></div></div>
                        <span class="stat-val">${val}</span>
                    </div>
                `).join('');
                // Pequeno delay para animar a entrada inicial
                setTimeout(() => UI.render(d), 50);
            } else {
                // Se já existe, apenas atualiza os valores e anima
                Object.entries(d.stats).forEach(([key, val]) => {
                    const row = statsDiv.querySelector(`.stat-row[data-key="${key}"]`);
                    if(row) {
                        const fill = row.querySelector('.stat-fill');
                        const text = row.querySelector('.stat-val');
                        const pct = Math.min(val, 100) + '%';
                        
                        if(fill.style.width !== pct) { fill.style.width = pct; fill.classList.remove('pulse-bar'); void fill.offsetWidth; fill.classList.add('pulse-bar'); }
                        if(text) text.innerText = val;
                    }
                });
            }
        }

        // Theme
        document.documentElement.setAttribute('data-theme', d.settings.theme);
        
        // Sync Settings UI
        if(document.getElementById('check-hardcore')) document.getElementById('check-hardcore').checked = d.settings.hardcore;
        if(document.getElementById('check-sound')) document.getElementById('check-sound').checked = d.settings.sound !== false;
        if(document.getElementById('check-anim')) document.getElementById('check-anim').checked = d.settings.animations !== false;

        // Tasks Rendering
        const rList = document.getElementById('list-routine');
        const qList = document.getElementById('list-quest');
        
        if(rList && qList) {
            rList.innerHTML = ''; qList.innerHTML = '';
            const today = new Date().toDateString();

            d.tasks.forEach(t => {
                const isDoneToday = t.lastDoneDate === today;
                const isFinished = t.finished;
                
                let html = `<div class="task-card ${t.type} ${isDoneToday ? 'done' : ''} ${isFinished ? 'finished' : ''}">`;
                
                if(t.mode === 'routine') {
                    html += `
                        <div class="row">
                            <span>${t.desc}</span>
                            ${isDoneToday 
                                ? '<i class="fa-solid fa-check task-done-icon"></i>' 
                                : `<button class="check-btn" onclick="App.completeTask(${t.id})"></button>`}
                        </div>`;
                } else {
                    const pct = (t.daysCurrent / t.daysTotal) * 100;
                    html += `
                        <div style="width:100%">
                            <div class="row">
                                <span>${t.desc}</span>
                                ${isFinished 
                                    ? '<i class="fa-solid fa-trophy" style="color:gold"></i>' 
                                    : (isDoneToday 
                                        ? '<small style="color:var(--success)">Hoje OK</small>' 
                                        : `<button class="check-btn" onclick="App.completeTask(${t.id})"></button>`)}
                            </div>
                            <div class="progress-track">
                                <div class="progress-fill" style="width: ${pct}%"></div>
                            </div>
                            <div style="display:flex; justify-content:space-between; font-size:0.7rem; margin-top:2px; opacity:0.7">
                                <span>${t.daysCurrent}/${t.daysTotal} dias</span>
                                <span>${t.type.toUpperCase()}</span>
                            </div>
                        </div>`;
                }
                html += `</div>`;

                if(t.mode === 'routine') rList.innerHTML += html;
                else qList.innerHTML += html;
            });
        }

        // Journal Rendering (NOVO)
        const jFeed = document.getElementById('journal-feed');
        if(jFeed) {
            jFeed.innerHTML = d.journal.map((entry, idx) => `
                <div class="journal-entry" onclick="this.classList.toggle('expanded')">
                    <div class="journal-header">
                        <small>${entry.date}</small>
                        <div style="display:flex; align-items:center;">
                            <span class="mood">${entry.mood}</span>
                            <button class="journal-delete-btn" onclick="event.stopPropagation(); App.deleteJournal(${idx})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                    <div class="journal-preview">Clique para expandir...</div>
                    <div class="journal-content"><p>${entry.text}</p></div>
                </div>
            `).join('');
        }
        
        // Vision & Skills
        const vGal = document.getElementById('vision-gallery');
        if(vGal) vGal.innerHTML = d.vision.map((u, idx)=>`
            <div class="vision-item" onclick="UI.viewImage('${u}')">
                <img src="${u}">
                <button class="vision-delete" onclick="event.stopPropagation(); App.deleteVisionItem(${idx})"><i class="fa-solid fa-trash"></i></button>
            </div>`).join('');
        
        document.querySelectorAll('.store-card').forEach((el, idx)=>{
             const ids = ['xp_boost', 'gold_boost'];
             if(d.skills.includes(ids[idx])) {
                 el.classList.add('unlocked');
                 // Atualiza visualmente para mostrar que já tem
                 const small = el.querySelector('small');
                 if(small) { small.innerText = "ADQUIRIDO"; small.style.color = "var(--success)"; }
             }
        });

        this.renderChart(d.stats);
        this.renderAchievements(d);
    },

    viewImage(src) {
        document.getElementById('img-viewer-src').src = src;
        this.toggleModal('image-modal', true);
    },

    confirm(msg, onYes) {
        document.getElementById('confirm-msg').innerText = msg;
        const btn = document.getElementById('confirm-btn-yes');
        btn.onclick = () => {
            onYes();
            UI.toggleModal('confirm-modal', false);
        };
        this.toggleModal('confirm-modal', true);
    },

    toast(msg, type = 'info') {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${msg}</span>
        `;
        container.appendChild(el);
        setTimeout(() => {
            el.style.animation = 'fadeOut 0.5s forwards';
            setTimeout(() => el.remove(), 500);
        }, 3000);
    },

    openAddModal(context) {
        document.getElementById('task-context').value = context;
        const durArea = document.getElementById('duration-area');
        
        if(context === 'goal') {
            durArea.classList.remove('hidden');
            document.querySelector('#add-modal h3').innerText = "Nova Meta Longa";
        } else {
            durArea.classList.add('hidden');
            document.querySelector('#add-modal h3').innerText = "Nova Rotina";
        } 
        this.toggleModal('add-modal', true);
    },

    openDeleteTaskModal(context) {
        const list = document.getElementById('delete-list');
        list.innerHTML = '';
        
        const tasks = App.data.tasks.filter(t => t.mode === context);
        
        if(tasks.length === 0) list.innerHTML = '<p class="center-text" style="color:var(--text-muted)">Nenhuma tarefa encontrada.</p>';
        
        tasks.forEach(t => {
            list.innerHTML += `<div class="delete-list-item"><span>${t.desc}</span> <button class="btn-mini btn-danger-glow" onclick="App.deleteTask(${t.id})"><i class="fa-solid fa-trash"></i></button></div>`;
        });

        this.toggleModal('delete-task-modal', true);
    },

    toggleModal(id, forceState) { 
        const el = document.getElementById(id);
        if (typeof forceState === 'boolean') {
            forceState ? el.classList.remove('hidden') : el.classList.add('hidden');
        } else {
            el.classList.toggle('hidden'); 
        }
    },

    switchTab(t) { 
        document.querySelectorAll('.tab-view').forEach(x=>x.classList.remove('active')); 
        document.getElementById('tab-'+t).classList.add('active'); 
        
        // Atualiza botões de navegação (Desktop e Mobile)
        document.querySelectorAll('.nav-btn, .b-btn').forEach(btn => {
            btn.classList.remove('active');
            if(btn.dataset.tab === t) btn.classList.add('active');
        });

        // Força a renderização do gráfico se entrar na aba de stats
        if(t === 'stats' && App.data) UI.renderChart(App.data.stats);
    },
    
    setTheme(t) { App.updateSetting('theme', t); App.init(); },

    renderChart(s) {
        const ctx = document.getElementById('statsChart');
        if(!ctx) return;
        if(this.chart) this.chart.destroy();
        this.chart = new Chart(ctx, {
            type: 'radar',
            data: { labels: ['DIS', 'INT', 'STR', 'ZEL'], datasets: [{ data: [s.dis, s.int, s.str, s.zel], backgroundColor: 'rgba(0, 242, 255, 0.2)', borderColor: '#00f2ff', pointBackgroundColor: '#fff' }] },
            options: { scales: { r: { ticks: { display: false }, grid: { color: 'rgba(255,255,255,0.1)' } } }, plugins: { legend: { display: false } }, maintainAspectRatio: false }
        });

        // Renderiza detalhes em texto
        const details = document.getElementById('stats-details');
        if(details) {
            details.innerHTML = `
                <div class="stat-box"><div class="stat-icon"><i class="fa-solid fa-briefcase"></i></div><small>Disciplina</small><span>${s.dis}</span></div>
                <div class="stat-box"><div class="stat-icon"><i class="fa-solid fa-brain"></i></div><small>Inteligência</small><span>${s.int}</span></div>
                <div class="stat-box"><div class="stat-icon"><i class="fa-solid fa-dumbbell"></i></div><small>Força</small><span>${s.str}</span></div>
                <div class="stat-box"><div class="stat-icon"><i class="fa-solid fa-heart"></i></div><small>Zelo</small><span>${s.zel}</span></div>
            `;
        }
    },

    renderAchievements(d) {
        const list = document.getElementById('badges-list');
        if(!list) return;

        list.innerHTML = App.achievementsList.map(b => {
            const isUnlocked = d.achievements.includes(b.id);
            return `
            <div class="badge-card ${isUnlocked ? 'unlocked' : ''}">
                <i class="fa-solid ${b.icon}"></i>
                <span>${b.title}</span>
                <small>${b.desc}</small>
            </div>
        `}).join('');
    }
};

const StepSystem = { 
    selected: null, 
    selectClass(el, c) { 
        document.querySelectorAll('.class-card').forEach(x=>x.classList.remove('selected')); 
        el.classList.add('selected'); // Adiciona classe visual de seleção
        this.selected = c; 
    } 
};

const Journal = { 
    m: '😐', 
    setMood(x){ this.m=x; UI.toast("Humor: "+x); }, 
    save(){ 
        const v = document.getElementById('journal-input').value; 
        if(v){ 
            App.data.journal.unshift({
                text: v, 
                mood: this.m,
                date: new Date().toLocaleString()
            }); 
            App.persist(); 
            document.getElementById('journal-input').value=''; 
            UI.render(App.data);
            UI.toast("Diário atualizado", "success"); 
        } 
    } 
};

const Pomodoro = { 
    t:null, s:1500, on:false, 
    toggle(){ 
        const o=document.getElementById('pomodoro-overlay'); 
        if(this.on){ 
            clearInterval(this.t); 
            o.classList.add('closing'); // Ativa animação de saída
            setTimeout(() => {
                o.classList.add('hidden'); 
                o.classList.remove('closing');
                this.s = 1500; // Reseta para 25min (1500s)
                document.getElementById('pomo-timer').innerText = "25:00"; // Reseta visual
            }, 500); // Espera a animação terminar
            this.on=false; 
        }else{ o.classList.remove('hidden'); this.on=true; this.t=setInterval(()=>{ this.s--; let m=Math.floor(this.s/60),sc=this.s%60; document.getElementById('pomo-timer').innerText=`${m}:${sc<10?'0'+sc:sc}`; if(this.s<=0){ clearInterval(this.t); UI.toast("Tempo Esgotado!", "success"); this.s=1500; this.toggle(); } },1000); } 
    } 
};

// Inicialização
window.onload = () => App.init();