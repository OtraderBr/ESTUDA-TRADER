// js/quiz.js
import { store } from './state.js';

let currentQuestionIndex = 0;
let score = 0;
let quizQuestions = [];
let quizActive = false;
let answerSubmitted = false;

function generateQuestions(concepts) {
    const probConcepts = concepts.filter(c => c.probabilidade);
    const shuffled = [...probConcepts].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    const allProbabilities = [...new Set(probConcepts.map(c => c.probabilidade))];
    
    return selected.map(c => {
        let options = [c.probabilidade];
        while (options.length < 4 && options.length < allProbabilities.length) {
            const randomProb = allProbabilities[Math.floor(Math.random() * allProbabilities.length)];
            if (!options.includes(randomProb)) options.push(randomProb);
        }
        const fallbackDistractors = ['40%', '60%', '70%', '80%', '90%'];
        while (options.length < 4) {
            const randomProb = fallbackDistractors[Math.floor(Math.random() * fallbackDistractors.length)];
            if (!options.includes(randomProb)) options.push(randomProb);
        }
        options.sort(() => 0.5 - Math.random());
        return { concept: c, correctAnswer: c.probabilidade, options };
    });
}

function startQuiz(concepts, container, state) {
    quizQuestions = generateQuestions(concepts);
    if(quizQuestions.length === 0) {
        alert("Nenhum conceito com probabilidade cadastrada foi encontrado.");
        return;
    }
    currentQuestionIndex = 0;
    score = 0;
    quizActive = true;
    answerSubmitted = false;
    renderQuiz(container, state);
}

export function renderQuiz(container, state) {
    const { concepts } = state;
    if (!quizActive) {
        container.innerHTML = `
            <div class="p-8 max-w-4xl mx-auto h-full flex flex-col items-center justify-center text-center">
                <div class="w-24 h-24 bg-blue-600/10 rounded-3xl flex items-center justify-center mb-6">
                    <i data-lucide="brain" class="w-12 h-12 text-blue-600"></i>
                </div>
                <h1 class="text-4xl font-bold text-zinc-900 mb-4 tracking-tight">Quiz de Probabilidades</h1>
                <p class="text-zinc-500 mb-8 max-w-lg text-lg">
                    Teste seu conhecimento nos Win Rates do Al Brooks.
                </p>
                <button id="startQuizBtn" class="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-lg">
                    Iniciar Simulado (10 Questões)
                </button>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
        document.getElementById('startQuizBtn')?.addEventListener('click', () => startQuiz(concepts, container, state));
        return;
    }

    if (currentQuestionIndex >= quizQuestions.length) {
        container.innerHTML = `
            <div class="p-8 max-w-3xl mx-auto h-full flex flex-col items-center justify-center text-center">
                <h2 class="text-4xl font-bold text-zinc-900 mb-2">Quiz Concluído!</h2>
                <div class="text-2xl text-zinc-500 mb-10">Você acertou <span class="font-black text-zinc-900">${score}</span> de ${quizQuestions.length}</div>
                <button id="restartQuizBtn" class="bg-zinc-900 hover:bg-zinc-800 text-white px-8 py-4 rounded-xl font-semibold">
                    Tentar Novamente
                </button>
            </div>
        `;
        document.getElementById('restartQuizBtn')?.addEventListener('click', () => { quizActive = false; renderQuiz(container, state); });
        return;
    }

    const currentQ = quizQuestions[currentQuestionIndex];
    container.innerHTML = `
        <div class="p-8 max-w-3xl mx-auto h-full flex flex-col">
            <div class="bg-white border text-center border-zinc-200 rounded-3xl p-8 mb-8">
                <div class="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2">Qual a probabilidade (Win Rate) de:</div>
                <h2 class="text-2xl font-bold text-zinc-800">${currentQ.concept.name}?</h2>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                ${currentQ.options.map(opt => `
                    <button class="quiz-opt-btn p-5 rounded-2xl border-2 border-zinc-200 bg-white text-lg font-bold text-zinc-700 text-left" data-value="${opt}">
                        ${opt}
                    </button>
                `).join('')}
            </div>
            ${answerSubmitted ? `
                <div class="flex justify-end">
                    <button id="nextQuestionBtn" class="bg-zinc-900 text-white px-8 py-3.5 rounded-xl font-bold">Próxima Pergunta</button>
                </div>
            ` : ''}
        </div>
    `;

    if (!answerSubmitted) {
        container.querySelectorAll('.quiz-opt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const selectedValue = e.currentTarget.getAttribute('data-value');
                answerSubmitted = true;
                container.querySelectorAll('.quiz-opt-btn').forEach(b => {
                    const val = b.getAttribute('data-value');
                    b.classList.add('opacity-50', 'pointer-events-none');
                    if (val === currentQ.correctAnswer) {
                        b.classList.remove('opacity-50', 'border-zinc-200');
                        b.classList.add('border-emerald-500', 'bg-emerald-50', 'text-emerald-700');
                    } else if (val === selectedValue) {
                        b.classList.remove('border-zinc-200');
                        b.classList.add('border-red-500', 'bg-red-50', 'text-red-700');
                    }
                });
                if (selectedValue === currentQ.correctAnswer) score++;
                renderQuiz(container, state);
            });
        });
    } else {
        document.getElementById('nextQuestionBtn')?.addEventListener('click', () => {
            currentQuestionIndex++;
            answerSubmitted = false;
            renderQuiz(container, state);
        });
    }
}
