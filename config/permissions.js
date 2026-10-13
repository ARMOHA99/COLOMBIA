'use strict';

module.exports = {
  rooms: [
    { key: 'view.dashboard', label: 'الداشبورد' },
    { key: 'view.card', label: 'بطاقتي' },
    { key: 'view.attendance', label: 'الدوام (تسجيل دخول وخروج واستراحة)' },
    { key: 'view.operations', label: 'العمليات (عرض)' },
    { key: 'view.farm', label: 'المزرعة (عرض)' },
    { key: 'view.internal', label: 'المتجر الداخلي (طلب الأصناف)' },
    { key: 'view.discipline', label: 'سجل الانضباط (عرض)' },
    { key: 'view.tickets', label: 'التذاكر (فتح تذكرة)' },
    { key: 'view.leaderboard', label: 'لوحة الشرف' },
    { key: 'view.shop', label: 'المتجر' },
    { key: 'view.orders', label: 'الطلبات (طلباته)' },
    { key: 'view.treasury', label: 'الخزينة (عرض)' },
    { key: 'view.items', label: 'الأصناف والأسعار (عرض)' }
  ],
  actions: [
    { key: 'ops.record', label: 'تسجيل وتعديل وحذف العمليات' },
    { key: 'farm.manage', label: 'إدارة المزرعة' },
    { key: 'treasury.write', label: 'الإيداع والسحب في الخزينة' },
    { key: 'items.write', label: 'تعديل الأصناف والأسعار' },
    { key: 'orders.handle', label: 'إدارة الطلبات (كل الطلبات وتغيير حالتها)' },
    { key: 'shop.manage', label: 'إدارة منتجات المتجر' },
    { key: 'internal.manage', label: 'إدارة أصناف المتجر الداخلي' },
    { key: 'discipline.write', label: 'إعطاء الإنذارات والغرامات' },
    { key: 'tickets.handle', label: 'معالجة التذاكر' },
    { key: 'members.view', label: 'عرض بطاقة أي عضو وسجل حضوره (بالضغط على اسمه في لوحة الشرف أو الدوام)' },
    { key: 'hours.deduct', label: 'خصم ساعات الأعضاء (يحتاج صلاحية عرض بطاقة العضو أعلاه)' },
    { key: 'admin.full', label: 'لوحة الإدارة الكاملة (كل شيء)' }
  ]
};
