import type { ProcedureNode } from '@/lib/demo/data';
import type { BuiltinLocale } from '@/lib/i18n/locale';

/**
 * A nested procedure per space, for the hierarchy explorer.
 *
 * Kept in its own file because it answers a different question from the
 * checklists in `data.ts`. Those show what filling one in feels like; these show
 * how deep a real procedure goes.
 *
 * EVERY TREE HAS ONE BRANCH THAT REACHES LEVEL FIVE. A claim about five levels
 * illustrated with two levels is not a claim, it is a picture of one — so the
 * deep branch exists in all three spaces and the explorer opens it by default,
 * because a visitor who never clicks should still see the point.
 *
 * The nesting is also the argument for the product: a flat list would have to
 * flatten "photograph the display" and "check the cold chain" into siblings, as
 * though they were the same size of thing. Real procedures are not flat, and a
 * tool that insists they are is asking somebody to lie about the work.
 */

const en: Record<string, ProcedureNode[]> = {
  depot: [
    {
      id: 'cold',
      label: 'Cold chain',
      children: [
        {
          id: 'store',
          label: 'Cold store',
          children: [
            {
              id: 'temp',
              label: 'Temperature check',
              children: [
                {
                  id: 'read',
                  label: 'Read the wall thermometer',
                  children: [
                    { id: 'shot', label: 'Photograph the display', photo: 'required' },
                  ],
                },
                { id: 'seal', label: 'Check the door seal' },
              ],
            },
            { id: 'freezer', label: 'Freezer holding below −18 °C' },
          ],
        },
        { id: 'bay', label: 'Loading bay clear' },
      ],
    },
    {
      id: 'machinery',
      label: 'Machinery',
      children: [{ id: 'guards', label: 'Guards fitted on both saws', photo: 'required' }],
    },
  ],
  cafe: [
    {
      id: 'foh',
      label: 'Front of house',
      children: [
        {
          id: 'floor',
          label: 'Floor and seating',
          children: [
            {
              id: 'tables',
              label: 'Tables wiped and set',
              children: [
                {
                  id: 'condiments',
                  label: 'Condiments refilled',
                  children: [{ id: 'sugar', label: 'Sugar caddies topped up' }],
                },
              ],
            },
          ],
        },
        {
          id: 'case',
          label: 'Display case',
          children: [{ id: 'dated', label: 'Stocked and dated', photo: 'required' }],
        },
      ],
    },
    {
      id: 'bar',
      label: 'Bar',
      children: [{ id: 'grinder', label: 'Grinder calibrated' }],
    },
  ],
  clinic: [
    {
      id: 'ward',
      label: 'Ward 3',
      children: [
        {
          id: 'room3',
          label: 'Room 3',
          children: [
            {
              id: 'bed',
              label: 'Bed turned over',
              children: [
                {
                  id: 'linen',
                  label: 'Linen changed',
                  children: [{ id: 'waste', label: 'Waste bagged and labelled' }],
                },
              ],
            },
            { id: 'sharps', label: 'Sharps bin below the fill line', photo: 'required' },
          ],
        },
        { id: 'room4', label: 'Room 4 ready' },
      ],
    },
    {
      id: 'equipment',
      label: 'Equipment',
      children: [{ id: 'trolley', label: 'Crash trolley seal intact', photo: 'required' }],
    },
  ],
};

const uz: Record<string, ProcedureNode[]> = {
  depot: [
    {
      id: 'cold',
      label: 'Sovuq zanjir',
      children: [
        {
          id: 'store',
          label: 'Sovuq ombor',
          children: [
            {
              id: 'temp',
              label: 'Harorat tekshiruvi',
              children: [
                {
                  id: 'read',
                  label: 'Devor termometrini oʻqish',
                  children: [
                    { id: 'shot', label: 'Displeyni suratga olish', photo: 'required' },
                  ],
                },
                { id: 'seal', label: 'Eshik zichligini tekshirish' },
              ],
            },
            { id: 'freezer', label: 'Muzlatgich −18 °C dan past' },
          ],
        },
        { id: 'bay', label: 'Yuklash maydoni boʻsh' },
      ],
    },
    {
      id: 'machinery',
      label: 'Uskunalar',
      children: [{ id: 'guards', label: 'Ikkala arrada himoya oʻrnatilgan', photo: 'required' }],
    },
  ],
  cafe: [
    {
      id: 'foh',
      label: 'Zal',
      children: [
        {
          id: 'floor',
          label: 'Pol va oʻtirgichlar',
          children: [
            {
              id: 'tables',
              label: 'Stollar artilgan va tayyorlangan',
              children: [
                {
                  id: 'condiments',
                  label: 'Ziravorlar toʻldirilgan',
                  children: [{ id: 'sugar', label: 'Shakardonlar toʻldirilgan' }],
                },
              ],
            },
          ],
        },
        {
          id: 'case',
          label: 'Vitrina',
          children: [{ id: 'dated', label: 'Toʻldirilgan va sanasi qoʻyilgan', photo: 'required' }],
        },
      ],
    },
    {
      id: 'bar',
      label: 'Bar',
      children: [{ id: 'grinder', label: 'Qahva tegirmoni sozlangan' }],
    },
  ],
  clinic: [
    {
      id: 'ward',
      label: '3-boʻlim',
      children: [
        {
          id: 'room3',
          label: '3-xona',
          children: [
            {
              id: 'bed',
              label: 'Karavot tozalandi',
              children: [
                {
                  id: 'linen',
                  label: 'Choyshab almashtirildi',
                  children: [{ id: 'waste', label: 'Chiqindi qopga solindi va belgilandi' }],
                },
              ],
            },
            { id: 'sharps', label: 'Oʻtkir chiqindi idishi belgidan past', photo: 'required' },
          ],
        },
        { id: 'room4', label: '4-xona tayyor' },
      ],
    },
    {
      id: 'equipment',
      label: 'Jihozlar',
      children: [{ id: 'trolley', label: 'Shoshilinch aravacha plombasi butun', photo: 'required' }],
    },
  ],
};

const ru: Record<string, ProcedureNode[]> = {
  depot: [
    {
      id: 'cold',
      label: 'Холодовая цепь',
      children: [
        {
          id: 'store',
          label: 'Холодный склад',
          children: [
            {
              id: 'temp',
              label: 'Проверка температуры',
              children: [
                {
                  id: 'read',
                  label: 'Снять показание настенного термометра',
                  children: [
                    { id: 'shot', label: 'Сфотографировать дисплей', photo: 'required' },
                  ],
                },
                { id: 'seal', label: 'Проверить уплотнитель двери' },
              ],
            },
            { id: 'freezer', label: 'Морозильник держит ниже −18 °C' },
          ],
        },
        { id: 'bay', label: 'Погрузочная зона свободна' },
      ],
    },
    {
      id: 'machinery',
      label: 'Оборудование',
      children: [{ id: 'guards', label: 'Защита установлена на обеих пилах', photo: 'required' }],
    },
  ],
  cafe: [
    {
      id: 'foh',
      label: 'Зал',
      children: [
        {
          id: 'floor',
          label: 'Пол и посадочные места',
          children: [
            {
              id: 'tables',
              label: 'Столы протёрты и сервированы',
              children: [
                {
                  id: 'condiments',
                  label: 'Приправы пополнены',
                  children: [{ id: 'sugar', label: 'Сахарницы наполнены' }],
                },
              ],
            },
          ],
        },
        {
          id: 'case',
          label: 'Витрина',
          children: [{ id: 'dated', label: 'Заполнена, даты проставлены', photo: 'required' }],
        },
      ],
    },
    {
      id: 'bar',
      label: 'Бар',
      children: [{ id: 'grinder', label: 'Кофемолка настроена' }],
    },
  ],
  clinic: [
    {
      id: 'ward',
      label: 'Отделение 3',
      children: [
        {
          id: 'room3',
          label: 'Кабинет 3',
          children: [
            {
              id: 'bed',
              label: 'Койка подготовлена',
              children: [
                {
                  id: 'linen',
                  label: 'Бельё сменено',
                  children: [{ id: 'waste', label: 'Отходы упакованы и подписаны' }],
                },
              ],
            },
            { id: 'sharps', label: 'Контейнер для острого ниже отметки', photo: 'required' },
          ],
        },
        { id: 'room4', label: 'Кабинет 4 готов' },
      ],
    },
    {
      id: 'equipment',
      label: 'Оборудование',
      children: [{ id: 'trolley', label: 'Пломба реанимационной тележки цела', photo: 'required' }],
    },
  ],
};

export const PROCEDURES: Record<BuiltinLocale, Record<string, ProcedureNode[]>> = { en, uz, ru };
