export const scenarios = [
  {
    id: 'fix-today',
    title: 'Fix-today list',
    tag: 'Multi-step join',
    expect: 'Code mode should win clearly: dozens of part checks stay in the sandbox.',
    prompt:
      "I'm a technician in the North region working out of depot D-NORTH. Which of my overdue work orders can I fix today with the parts currently in stock at my depot? List them by priority with the parts needed.",
  },
  {
    id: 'backlog',
    title: 'Regional backlog',
    tag: 'Aggregation over large data',
    expect: 'Code mode should win big: hundreds of work orders are counted in code, not read by the model.',
    prompt:
      'Give me a backlog summary for every region: number of open and in-progress work orders, how many are overdue, and the average days overdue. Which region needs extra technicians most?',
  },
  {
    id: 'lookup',
    title: 'Single lookup',
    tag: 'One tool call',
    expect: 'Roughly a tie, or direct MCP wins: code mode pays a fixed cost for its API docs and script.',
    prompt: "What's the status of work order WO-1042, who is assigned, and what parts does it need?",
  },
];
