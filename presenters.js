// "View" слой API: что именно уходит клиенту (пароли и внутренние поля не утекают).
export const userView = u => ({ id: u.id, email: u.email, plan: u.plan, createdAt: u.createdAt });
export const savedChartView = c => ({ id: c.id, name: c.name, input: c.input, summary: c.summary, createdAt: c.createdAt });
