/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */
function calculateSimpleRevenue(purchase, _product) {
    // Расчет выручки от операции
    const { discount, sale_price, quantity } = purchase;
    
    // Коэффициент для расчета суммы без скидки в десятичном формате
    const discountCoefficient = 1 - (discount / 100);
    
    // Выручка = цена × количество × коэффициент скидки
    return sale_price * quantity * discountCoefficient;
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */
function calculateBonusByProfit(index, total, seller) {
    // Расчет бонуса от позиции в рейтинге
    // 15% — для продавца, который принёс наибольшую прибыль
    if (index === 0) {
        return seller.profit * 0.15;
    }
    // 10% — для продавцов, которые оказались на втором и третьем месте по прибыли
    else if (index === 1 || index === 2) {
        return seller.profit * 0.10;
    }
    // 0% — для продавца, который оказался на последнем месте
    else if (index === total - 1) {
        return 0;
    }
    // 5% — для всех остальных продавцов, кроме последнего
    else {
        return seller.profit * 0.05;
    }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */
function analyzeSalesData(data, options) {
    // Проверка входных данных
    if (!data
        || !Array.isArray(data.sellers)
        || !Array.isArray(data.products)
        || !Array.isArray(data.purchase_records)
        || data.sellers.length === 0
        || data.products.length === 0
        || data.purchase_records.length === 0
    ) {
        throw new Error('Некорректные входные данные');
    }

    // Проверка наличия опций
    if (typeof options !== 'object' || options === null) {
        throw new Error('Опции должны быть объектом');
    }
    
    const { calculateRevenue, calculateBonus } = options;
    
    if (!calculateRevenue || !calculateBonus) {
        throw new Error('Не переданы функции для расчета');
    }
    
    if (typeof calculateRevenue !== 'function' || typeof calculateBonus !== 'function') {
        throw new Error('Переданные опции должны быть функциями');
    }

    // Подготовка промежуточных данных для сбора статистики
    const sellerStats = data.sellers.map(seller => ({
        id: seller.id,
        name: `${seller.first_name} ${seller.last_name}`,
        revenue: 0,
        profit: 0,
        sales_count: 0,
        products_sold: {}
    }));

    // Индексация продавцов и товаров для быстрого доступа
    const sellerIndex = Object.fromEntries(
        sellerStats.map(seller => [seller.id, seller])
    );
    
    const productIndex = Object.fromEntries(
        data.products.map(product => [product.sku, product])
    );

    // Расчет выручки и прибыли для каждого продавца
    data.purchase_records.forEach(record => {
        const seller = sellerIndex[record.seller_id];
        if (!seller) return; // Пропускаем, если продавец не найден
        
        // Увеличиваем количество продаж
        seller.sales_count += 1;
        
        // Увеличиваем общую сумму выручки
        seller.revenue += record.total_amount;
        
        // Расчет прибыли по каждому товару в чеке
        record.items.forEach(item => {
            const product = productIndex[item.sku];
            if (!product) return; // Пропускаем, если товар не найден
            
            // Себестоимость = цена закупки × количество
            const cost = product.purchase_price * item.quantity;
            
            // Выручка с учетом скидки
            const revenue = calculateRevenue(item, product);
            
            // Прибыль = выручка - себестоимость
            const profit = revenue - cost;
            
            // Увеличиваем общую накопленную прибыль продавца
            seller.profit += profit;
            
            // Учет количества проданных товаров
            if (!seller.products_sold[item.sku]) {
                seller.products_sold[item.sku] = 0;
            }
            seller.products_sold[item.sku] += item.quantity;
        });
    });

    // Сортировка продавцов по прибыли (по убыванию)
    sellerStats.sort((a, b) => b.profit - a.profit);

    // Назначение премий на основе ранжирования
    const totalSellers = sellerStats.length;
    
    sellerStats.forEach((seller, index) => {
        // Расчет бонуса
        seller.bonus = calculateBonus(index, totalSellers, seller);
        
        // Формирование топ-10 товаров
        const productsArray = Object.entries(seller.products_sold)
            .map(([sku, quantity]) => ({ sku, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        
        seller.top_products = productsArray;
    });

    // Подготовка итоговой коллекции с нужными полями
    return sellerStats.map(seller => ({
        seller_id: seller.id,
        name: seller.name,
        revenue: +seller.revenue.toFixed(2),
        profit: +seller.profit.toFixed(2),
        sales_count: seller.sales_count,
        top_products: seller.top_products,
        bonus: +seller.bonus.toFixed(2)
    }));
}