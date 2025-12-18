-- Auto-Reply Intents for ULBRA
-- Execute this SQL in Neon Dashboard to add the intents

-- 1. Dúvida com Matrícula
INSERT INTO auto_replies (name, intent_description, example_messages, response_template, is_active, priority, confidence_threshold)
VALUES (
    'Dúvida com Matrícula',
    'O aluno não sabe como continuar a sua matrícula, precisa de informações sobre o vestibular, está com dúvidas sobre o processo de matrícula',
    ARRAY['Como faço minha matrícula?', 'Não sei continuar a matrícula', 'Preciso de ajuda com a matrícula', 'Informações sobre vestibular', 'Como me matricular?'],
    'Oi {{name}}! 👋 Em relação à matrícula, posso passar seu contato a um de nossos consultores. Eles vão te ajudar com todo o processo! Pode me passar seu melhor contato?',
    true,
    10,
    0.70
);

-- 2. Informações sobre o Curso
INSERT INTO auto_replies (name, intent_description, example_messages, response_template, is_active, priority, confidence_threshold)
VALUES (
    'Informações sobre o Curso',
    'Cliente quer informações sobre o curso, deseja saber mais detalhes, está interessado em conhecer o curso',
    ARRAY['Gostaria de mais informações', 'Quero saber mais sobre o curso', 'Me fala sobre o curso', 'Informações do curso', 'Como é o curso?'],
    'Ei! 👋 Super legal que você está interessado(a) no nosso curso. Com apenas 2 anos e meio, você pode mergulhar fundo em uma carreira que não exige diploma para começar. E olha só: 80% dos nossos alunos já estão fazendo sucesso no mercado. Imagina só, você pode ser um deles, até trabalhando de casa! Mas corre, as vagas são limitadas! 🚀',
    true,
    9,
    0.70
);

-- 3. Onde Posso Trabalhar
INSERT INTO auto_replies (name, intent_description, example_messages, response_template, is_active, priority, confidence_threshold)
VALUES (
    'Onde Posso Trabalhar',
    'Cliente quer saber sobre oportunidades de trabalho, mercado de trabalho, onde pode atuar, possibilidades de carreira',
    ARRAY['Onde posso trabalhar?', 'Quais são as oportunidades?', 'Onde vou trabalhar?', 'Mercado de trabalho', 'Posso trabalhar remoto?'],
    '🌍 Com um curso de TI, você pode literalmente trabalhar de qualquer canto do planeta. As vagas remotas estão bombando e só aumentam a cada dia. E olha só, até 2025, vai rolar um déficit de 530 mil profissionais na área. Traduzindo: oportunidades que não acabam mais para você!',
    true,
    8,
    0.75
);

-- 4. Presencial ou EAD
INSERT INTO auto_replies (name, intent_description, example_messages, response_template, is_active, priority, confidence_threshold)
VALUES (
    'Presencial ou EAD',
    'Cliente quer saber sobre a modalidade do curso, se é presencial ou EAD, diferenças entre presencial e online',
    ARRAY['É presencial ou EAD?', 'Tem presencial?', 'É online?', 'Qual a diferença?', 'Presencial vale mais?'],
    'Quando se trata de dar os primeiros passos em sua carreira, a escolha entre ensino presencial e EAD é crucial. O ensino presencial oferece vantagens únicas:

✨ **Networking Estratégico**: Conexões diárias que podem ser a ponte para seu próximo emprego
💼 **Experiência Prática Valorizada**: Labs e projetos em grupo muito valorizados por empregadores
🤝 **Habilidades Interpessoais**: Desenvolvimento de comunicação, adaptabilidade e trabalho em equipe
📚 **Recursos Completos**: Acesso imediato a professores, bibliotecas e laboratórios

Se você busca uma rota direta para o emprego, o presencial pode ser o caminho ideal! Quer saber mais?',
    true,
    7,
    0.70
);

-- 5. Por que fazer na ULBRA
INSERT INTO auto_replies (name, intent_description, example_messages, response_template, is_active, priority, confidence_threshold)
VALUES (
    'Por que fazer na ULBRA',
    'Cliente quer saber por que escolher a ULBRA, diferenciais da instituição, qualidade do ensino, reputação',
    ARRAY['Por que ULBRA?', 'Por que fazer aí?', 'O que tem de diferente?', 'Vale a pena?', 'ULBRA é boa?'],
    'Escolher a ULBRA é uma decisão estratégica! 🎓

🌟 **Nota Máxima no MEC** - Curso ADS com nota 4 no ENADE
💼 **80% de Empregabilidade** - Nossos formandos já atuam no mercado
🤝 **Networking de Alto Nível** - Professores são profissionais atuantes
🏢 **Parcerias com Empresas** - Estágios e empregos garantidos
📈 **Orientação Profissional** - Preparação completa para o mercado
⚡ **Um dos Melhores do RS** - Excelência reconhecida

Na ULBRA, você não escolhe apenas uma faculdade, escolhe um parceiro para o seu sucesso! Vamos conversar mais?',
    true,
    6,
    0.70
);

-- 6. Informações Gerais / Ajuda
INSERT INTO auto_replies (name, intent_description, example_messages, response_template, is_active, priority, confidence_threshold)
VALUES (
    'Preciso de Ajuda',
    'Cliente está pedindo ajuda geral, não se encaixa em nenhuma categoria específica, quer falar com alguém',
    ARRAY['Preciso de ajuda', 'Pode me ajudar?', 'Tenho uma dúvida', 'Quero falar com alguém', 'Atendimento'],
    'Olá {{name}}! 👋 Estou aqui para ajudar! Pode me contar o que você precisa? Ou se preferir, posso conectar você com um de nossos consultores especializados. O que acha?',
    true,
    1,
    0.65
);
