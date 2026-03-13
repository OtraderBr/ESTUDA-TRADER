// js/state.js
// Gerenciamento de estado global reativo da aplicação

class Store {
    constructor() {
        this.state = {
            concepts: [],
            sessions: [],
            loading: true,
            sidebarOpen: false,
            currentPage: 'dashboard',
            selectedConceptId: null
        };
        this.listeners = [];
    }

    // Registra componentes para reagirem a mudanças
    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    // Atualiza o estado e notifica
    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    getState() {
        return this.state;
    }

    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }
}

export const store = new Store();
