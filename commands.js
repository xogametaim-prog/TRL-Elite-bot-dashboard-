const commandsList = {
    owner: [
        { name: '+give [user] [amount]', desc: 'لإضافة كوينز للعضو' },
        { name: '+take [user] [amount]', desc: 'لسحب كوينز من العضو' },
        { name: '+bank [bank id]', desc: 'لوضع ايدي البنك الجديد' },
        { name: '+limite [limite members]', desc: 'لوضع أقل عدد للأعضاء من الشراء' },
        { name: '+clinet [role id]', desc: 'لوضع رول الشراء' },
        { name: '+stock img [img link]', desc: 'لوضع صورة للستوك' },
        { name: '+panel img [img link]', desc: 'لوضع صورة للبانل وأيضاً يمكنك تركها بدون صورة' },
        { name: '+add [serverid] [amount]', desc: 'لإدخال أعضاء للسيرفر' },
        { name: '+check [user]', desc: 'لفحص إذا الشخص موثق نفسه أم لا' },
        { name: '+send', desc: 'لبعث زر وثق نفسك' },
        { name: '+refresh', desc: 'لعمل رفرش للستوك' },
        { name: '+spun', desc: 'لإرسال زر عجلة حظ' },
        { name: '+delete-tickets', desc: 'اغلاق كل التذاكر' },
        { name: '+restart', desc: 'لإعادة تشغيل البوت' },
        { name: '+panel', desc: 'لبعث لوحة شراء أعضاء' },
        { name: '+transfer', desc: 'لتحديد روم التحويل' },
        { name: '+taxid', desc: 'لتحديد روم الضريبة' },
        { name: '+leave [server id]', desc: 'للخروج من سيرفر البوت فيه' },
        { name: '+log', desc: 'لوضع ايدي روم تمت العملية' },
        { name: '+price', desc: 'لوضع سعر الأعضاء' },
        { name: '+leaveall', desc: 'لإخراج البوت من جميع السيرفرات' },
        { name: '+set name [name]', desc: 'لوضع اسم للبوت' },
        { name: '+set avatar [avatar link]', desc: 'لتغيير صورة البوت' },
        { name: '+mozz3 [mozz3 role id]', desc: 'لوضع ايدي رول الموزعين' },
        { name: '+sendp', desc: 'لبعث لوحة أسعار الكوينز' },
        { name: '+sendp1', desc: 'لبعث رسالة السعر الخاصة' },
        { name: '+nitro', desc: 'لبعث عرض نيترو مجاني' },
        { name: '+say [message]', desc: 'لكتابة رسالة من خلال البوت' }
    ],
    public: [
        { name: '+help', desc: 'لعرض قائمة المساعدة والأوامر مقسمة' },
        { name: '+info', desc: 'لعرض ملفك الشخصي ومعلومات مطور البوت' },
        { name: '+stock', desc: 'لمعرفة ستوك الأعضاء المتواجد في المخزون' },
        { name: '+coins', desc: 'لمعرفة رصيدك الحالي' },
        { name: '+boost', desc: 'لاستلام هدية البوست' },
        { name: '+top', desc: 'أعلى 6 أشخاص يمتلكون كوينز' },
        { name: '+invite', desc: 'لدعوة البوت الخاص بالأعضاء' },
        { name: '+tax [amount]', desc: 'لحساب الضريبة' }
    ]
};

module.exports = commandsList;
