import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLanguageSystemInstruction,
  buildPdfExportData,
  deriveConversationTitle,
  extractGroundingSources,
  extractReadableErrorMessage,
  filterConversations,
  formatFileSize,
  formatModelContents,
  getFolderChatCounts,
  groupConversationsByDate,
  parseMarkdownBlocksForPdf,
  sanitizePdfFilename,
  stripMarkdownForSpeech,
  unassignFolderFromConversations,
  validateChatRequest,
  validateTtsRequest,
} from './chatUtils.ts';
import type { ChatFolder, ChatMessage, Conversation } from '../types/chat.ts';

test('deriveConversationTitle normalizes whitespace and truncates cleanly', () => {
  assert.equal(deriveConversationTitle('   '), 'New chat');
  assert.equal(
    deriveConversationTitle('Explain quantum computing'),
    'Explain quantum computing'
  );
  const longTitle = deriveConversationTitle(
    'Please write a comprehensive React TypeScript component for a sortable data table'
  );
  assert.ok(longTitle.endsWith('...'));
  assert.ok(longTitle.length <= 45);
});

test('formatFileSize formats KB and MB cleanly', () => {
  assert.equal(formatFileSize(500), '1 KB');
  assert.equal(formatFileSize(1024 * 250), '250 KB');
  assert.equal(formatFileSize(1024 * 1024 * 2.5), '2.5 MB');
});

test('groupConversationsByDate groups conversations accurately into Today, Yesterday, Previous 7 Days, and Older', () => {
  const now = new Date(2026, 10, 24, 15, 0, 0).getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  const items: Conversation[] = [
    {
      id: '1',
      title: 'Today chat',
      createdAt: now,
      updatedAt: now - 1000,
      modeId: 'balanced',
      messages: [],
    },
    {
      id: '2',
      title: 'Yesterday chat',
      createdAt: now,
      updatedAt: now - oneDay,
      modeId: 'balanced',
      messages: [],
    },
    {
      id: '3',
      title: 'Week chat',
      createdAt: now,
      updatedAt: now - 4 * oneDay,
      modeId: 'balanced',
      messages: [],
    },
    {
      id: '4',
      title: 'Old chat',
      createdAt: now,
      updatedAt: now - 15 * oneDay,
      modeId: 'balanced',
      messages: [],
    },
  ];

  const grouped = groupConversationsByDate(items, now);
  assert.deepEqual(
    grouped.map((g) => g.label),
    ['Today', 'Yesterday', 'Previous 7 Days', 'Older']
  );
});

test('filterConversations matches both title and message content case-insensitively', () => {
  const items: Conversation[] = [
    {
      id: 'a',
      title: 'React Hooks',
      createdAt: 1,
      updatedAt: 1,
      modeId: 'balanced',
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'How does useEffect work?',
          createdAt: 1,
        },
      ],
    },
    {
      id: 'b',
      title: 'Dinner ideas',
      createdAt: 2,
      updatedAt: 2,
      modeId: 'fast',
      messages: [
        {
          id: 'm2',
          role: 'user',
          content: 'Give me paneer tikka recipe',
          createdAt: 2,
        },
      ],
    },
  ];

  assert.equal(filterConversations(items, '').length, 2);
  assert.deepEqual(
    filterConversations(items, 'paneer').map((c) => c.id),
    ['b']
  );
  assert.deepEqual(
    filterConversations(items, 'hooks').map((c) => c.id),
    ['a']
  );
});

test('formatModelContents omits error messages and includes image and PDF inline parts', () => {
  const messages: ChatMessage[] = [
    {
      id: '1',
      role: 'user',
      content: '',
      createdAt: 1,
      attachments: [
        {
          id: 'att1',
          kind: 'image',
          name: 'photo.png',
          mimeType: 'image/png',
          sizeBytes: 1200,
          dataBase64: 'YWJj',
          previewUrl: 'data:image/png;base64,YWJj',
        },
        {
          id: 'att2',
          kind: 'pdf',
          name: 'notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4200,
          dataBase64: 'ZGVm',
        },
      ],
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Failed earlier',
      createdAt: 2,
      isError: true,
    },
    {
      id: '3',
      role: 'assistant',
      content: 'Here is the summary.',
      createdAt: 3,
    },
  ];

  const contents = formatModelContents(messages);
  assert.equal(contents.length, 2);
  assert.equal(contents[0].role, 'user');
  assert.equal(contents[0].parts.length, 3);
  assert.equal(contents[0].parts[0].inlineData?.mimeType, 'image/png');
  assert.equal(contents[0].parts[1].inlineData?.mimeType, 'application/pdf');
  assert.ok(contents[0].parts[2].text?.includes('analyze the attached'));
});

test('extractGroundingSources deduplicates URIs and filters unsafe schemes', () => {
  const sources = extractGroundingSources([
    { web: { uri: 'https://example.com/a', title: 'Example A' } },
    { web: { uri: 'https://example.com/a', title: 'Duplicate A' } },
    { web: { uri: 'javascript:alert(1)', title: 'Bad' } },
    { web: { uri: 'https://news.ycombinator.com/item?id=1' } },
  ]);

  assert.equal(sources.length, 2);
  assert.equal(sources[0].title, 'Example A');
  assert.equal(sources[1].title, 'news.ycombinator.com');
});

test('buildLanguageSystemInstruction injects language directive and custom instructions', () => {
  const hindi = buildLanguageSystemInstruction('hindi', 'Keep bullet points short.');
  assert.ok(hindi.includes('Hindi (Devanagari script)'));
  assert.ok(hindi.includes('Keep bullet points short.'));

  const marathi = buildLanguageSystemInstruction('marathi');
  assert.ok(marathi.includes('Marathi (Devanagari script)'));

  const hinglish = buildLanguageSystemInstruction('hinglish');
  assert.ok(hinglish.includes('Hinglish'));
});

test('validateChatRequest accepts PDF attachments and marathi languageMode', () => {
  assert.equal(validateChatRequest(null).ok, false);
  assert.equal(validateChatRequest({ messages: [] }).ok, false);

  const valid = validateChatRequest({
    modeId: 'fast',
    languageMode: 'marathi',
    useWebSearch: true,
    messages: [
      {
        role: 'user',
        content: 'Summarize this PDF',
        attachments: [{ mimeType: 'application/pdf', dataBase64: 'JVBERi0xLjQ=' }],
      },
    ],
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.languageMode, 'marathi');
    assert.equal(valid.data.messages[0].attachments?.[0].mimeType, 'application/pdf');
  }
});

test('extractReadableErrorMessage formats nested 503 JSON errors cleanly', () => {
  const raw = JSON.stringify({
    error: {
      message: JSON.stringify({
        error: { code: 503, message: 'High demand', status: 'UNAVAILABLE' },
      }),
      code: 503,
      status: 'Service Unavailable',
    },
  });
  const friendly = extractReadableErrorMessage(raw);
  assert.ok(friendly.includes('temporarily experiencing high demand'));
});

test('stripMarkdownForSpeech cleans markdown formatting while preserving multilingual text', () => {
  const md = [
    '## Summary',
    '',
    '- Read [this guide](https://example.com) for **important** tips.',
    '- Use `useState` cleanly.',
    '',
    '```ts',
    'const x = 1;',
    '```',
    '',
    'मराठी आणि हिन्दी मजकूर सुरक्षित राहावा.',
  ].join('\n');

  const spoken = stripMarkdownForSpeech(md);
  assert.ok(spoken.includes('Summary'));
  assert.ok(spoken.includes('Read this guide for important tips.'));
  assert.ok(spoken.includes('Use useState cleanly.'));
  assert.ok(spoken.includes('Code snippet omitted.'));
  assert.ok(spoken.includes('मराठी आणि हिन्दी मजकूर सुरक्षित राहावा.'));
  assert.ok(!spoken.includes('https://example.com'));
  assert.ok(!spoken.includes('```'));
  assert.ok(!spoken.includes('**'));
});

test('validateTtsRequest validates and normalizes TTS payloads', () => {
  assert.equal(validateTtsRequest(null).ok, false);
  assert.equal(validateTtsRequest({ text: '   ' }).ok, false);

  const valid = validateTtsRequest({
    text: '**Hello** [world](https://example.com)!',
    languageMode: 'hindi',
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.data.text, 'Hello world!');
    assert.equal(valid.data.languageMode, 'hindi');
  }
});

test('sanitizePdfFilename normalizes titles and handles empty or unsafe characters', () => {
  assert.equal(
    sanitizePdfFilename('30-day Python study roadmap'),
    '30-day-python-study-roadmap.pdf'
  );
  assert.equal(sanitizePdfFilename('  ///???  '), 'riva-ai-chat.pdf');
  assert.equal(
    sanitizePdfFilename('मराठी किल्ले: माहिती'),
    'मराठी-किल्ले-माहिती.pdf'
  );
});

test('parseMarkdownBlocksForPdf extracts headings, bullets, paragraphs, and code blocks', () => {
  const md = [
    '### Week 1',
    '- Learn **variables** cleanly',
    '',
    '```python',
    'print("Hi")',
    '```',
    '',
    'See [docs](https://example.com).',
  ].join('\n');

  const blocks = parseMarkdownBlocksForPdf(md);
  assert.equal(blocks.length, 4);
  assert.deepEqual(blocks[0], { kind: 'heading', text: 'Week 1' });
  assert.deepEqual(blocks[1], {
    kind: 'bullet',
    text: 'Learn variables cleanly',
  });
  assert.deepEqual(blocks[2], {
    kind: 'code',
    language: 'python',
    text: 'print("Hi")',
  });
  assert.deepEqual(blocks[3], {
    kind: 'paragraph',
    text: 'See docs (https://example.com).',
  });
});

test('buildPdfExportData structures conversation metadata, attachments, and sources', () => {
  const conv: Conversation = {
    id: 'c1',
    title: 'Python Roadmap',
    createdAt: 1700000000000,
    updatedAt: 1700000005000,
    modeId: 'balanced',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'Plan please',
        createdAt: 1700000000000,
        attachments: [
          {
            id: 'a1',
            kind: 'pdf',
            name: 'syllabus.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 2048,
            dataBase64: 'JVBER',
          },
        ],
      },
      {
        id: 'm2',
        role: 'assistant',
        content: '## Step 1\nStart today.',
        createdAt: 1700000005000,
        sources: [{ title: 'Python Docs', uri: 'https://docs.python.org' }],
      },
    ],
  };

  const doc = buildPdfExportData(conv, 'Riva Balanced', 1700000010000);
  assert.equal(doc.filename, 'python-roadmap.pdf');
  assert.equal(doc.modeLabel, 'Riva Balanced');
  assert.equal(doc.messages.length, 2);
  assert.deepEqual(doc.messages[0].attachments, ['PDF: syllabus.pdf (2 KB)']);
  assert.equal(doc.messages[1].blocks[0].kind, 'heading');
  assert.equal(doc.messages[1].sources[0].title, 'Python Docs');
});

test('filterConversations, getFolderChatCounts, and unassignFolderFromConversations manage topic folders cleanly', () => {
  const folders: ChatFolder[] = [
    { id: 'f-code', name: 'Coding', color: 'blue', createdAt: 1 },
    { id: 'f-travel', name: 'Travel', color: 'emerald', createdAt: 2 },
  ];

  const items: Conversation[] = [
    {
      id: 'c1',
      title: 'TypeScript Generics',
      createdAt: 1,
      updatedAt: 1,
      modeId: 'balanced',
      folderId: 'f-code',
      messages: [],
    },
    {
      id: 'c2',
      title: 'Pune Weekend Trip',
      createdAt: 2,
      updatedAt: 2,
      modeId: 'fast',
      folderId: 'f-travel',
      messages: [],
    },
    {
      id: 'c3',
      title: 'Random Thought',
      createdAt: 3,
      updatedAt: 3,
      modeId: 'lite',
      messages: [],
    },
  ];

  assert.deepEqual(
    filterConversations(items, '', 'f-code').map((c) => c.id),
    ['c1']
  );
  assert.deepEqual(
    filterConversations(items, '', 'uncategorized').map((c) => c.id),
    ['c3']
  );
  assert.deepEqual(
    filterConversations(items, 'pune', 'f-travel').map((c) => c.id),
    ['c2']
  );
  assert.equal(filterConversations(items, 'pune', 'f-code').length, 0);

  const counts = getFolderChatCounts(items, folders);
  assert.equal(counts.all, 3);
  assert.equal(counts.uncategorized, 1);
  assert.equal(counts.byFolder['f-code'], 1);
  assert.equal(counts.byFolder['f-travel'], 1);

  const afterDelete = unassignFolderFromConversations(items, 'f-code');
  assert.equal(afterDelete[0].folderId, null);
  assert.equal(afterDelete[1].folderId, 'f-travel');
});



