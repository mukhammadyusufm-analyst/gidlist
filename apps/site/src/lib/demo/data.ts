import type { BuiltinLocale } from '@/lib/i18n/locale';

/**
 * The demo dataset the whole page shares.
 *
 * ONE DATASET, ONE STORY. Every interactive module on the page reads from this
 * and from the state built on top of it, so what a visitor does in the hero is
 * still true in the charts near the bottom. That continuity is the difference
 * between a page of separate widgets and a page that behaves like the product.
 *
 * THE SPACES ARE NOT CUSTOMERS. They are named for what they are — a coffee
 * chain, a depot, a clinic — precisely so nobody can read them as a client list.
 * Nothing here implies anyone uses Gidlist; it is a sample dataset and says so.
 *
 * EVERY CAPABILITY SHOWN HERE IS REAL. Photo, file and location can each be off,
 * offered, or required, independently of one another. Nesting runs five levels.
 * Recurrence is daily, weekly or monthly. Work goes to everyone in a space, to
 * named people, or to whoever created it. What is deliberately absent is any
 * enforced submission *time window* — that does not exist in the product yet, so
 * no scene claims it.
 *
 * TIMES ARE FIXED, NOT THE VISITOR'S CLOCK. Every stamp is part of the scene, so
 * the page reads as a real 06:14 shift rather than as a toy that knows what time
 * it is where you happen to be sitting. It also means the server and the browser
 * render identical markup, which a `new Date()` here would break.
 */

export type Requirement = 'off' | 'offered' | 'required';

export type DemoTask = {
  id: string;
  label: string;
  /** 0-based indent. The product allows five levels; the deep branch proves it. */
  depth: number;
  photo: Requirement;
  /**
   * A document rather than a photograph — a signed delivery note, a calibration
   * certificate, a service sheet. Independent of the other two, like everything
   * else here: a task can demand a file and merely offer a photo.
   */
  file: Requirement;
  location: Requirement;
  /** The stamp shown beside the task once it is ticked. */
  at: string;
};

export type DemoChecklist = {
  id: string;
  name: string;
  /** Daily, weekly or monthly — the three the product actually supports. */
  every: string;
  at: string;
  who: string;
  tasks: DemoTask[];
};

export type DemoSpace = {
  id: string;
  /** What the space is, not who owns it. */
  name: string;
  kind: string;
  members: { initials: string; name: string }[];
  checklists: DemoChecklist[];
};

type Pack = {
  spaces: DemoSpace[];
  /** Words the modules need that are not part of a space. */
  words: {
    photo: string;
    location: string;
    file: string;
    note: string;
    fileName: string;
    required: string;
    offered: string;
    off: string;
    everyone: string;
    sampleData: string;
  };
};

const en: Pack = {
  words: {
    photo: 'Photo',
    location: 'Location',
    file: 'File',
    note: 'Note',
    required: 'required',
    offered: 'offered',
    off: 'off',
    fileName: 'calibration-cert-4471.pdf',
    everyone: 'Everyone in this space',
    sampleData: 'Sample data',
  },
  spaces: [
    {
      id: 'depot',
      name: 'Logistics depot',
      kind: 'One site, two shifts',
      members: [
        { initials: 'DK', name: 'D. Karimova' },
        { initials: 'ST', name: 'S. Toshmatov' },
        { initials: 'AR', name: 'A. Rahimov' },
      ],
      checklists: [
        {
          id: 'opening',
          name: 'Opening check · Line 2',
          every: 'Every day',
          at: '06:00',
          who: 'Everyone in this space',
          tasks: [
            { id: 't1', label: 'Cold store temperature logged', depth: 0, photo: 'required', file: 'required', location: 'offered', at: '06:14' },
            { id: 't2', label: 'Reading within range', depth: 1, photo: 'off', file: 'off', location: 'off', at: '06:14' },
            { id: 't3', label: 'Guards fitted on both saws', depth: 0, photo: 'required', file: 'off', location: 'off', at: '06:15' },
            { id: 't4', label: 'Waste bins emptied', depth: 0, photo: 'off', file: 'off', location: 'off', at: '06:31' },
          ],
        },
      ],
    },
    {
      id: 'cafe',
      name: 'Coffee chain',
      kind: 'Four branches, one routine',
      members: [
        { initials: 'NB', name: 'N. Bekmurodova' },
        { initials: 'IY', name: 'I. Yusupov' },
      ],
      checklists: [
        {
          id: 'open',
          name: 'Store opening · Branch 3',
          every: 'Every day',
          at: '07:30',
          who: 'Everyone in this space',
          tasks: [
            { id: 'c1', label: 'Front of house ready', depth: 0, photo: 'required', file: 'off', location: 'required', at: '07:41' },
            { id: 'c2', label: 'Display case stocked and dated', depth: 1, photo: 'required', file: 'off', location: 'off', at: '07:44' },
            { id: 'c3', label: 'Grinder calibrated', depth: 0, photo: 'off', file: 'off', location: 'off', at: '07:52' },
            { id: 'c4', label: 'Fridge temperatures recorded', depth: 0, photo: 'required', file: 'required', location: 'off', at: '07:58' },
          ],
        },
      ],
    },
    {
      id: 'clinic',
      name: 'Clinic',
      kind: 'Three rooms, daily readiness',
      members: [
        { initials: 'MA', name: 'M. Aliyeva' },
        { initials: 'RS', name: 'R. Saidov' },
        { initials: 'GN', name: 'G. Nazarova' },
      ],
      checklists: [
        {
          id: 'rooms',
          name: 'Room readiness · Ward 3',
          every: 'Every day',
          at: '08:00',
          who: '3 named people',
          tasks: [
            { id: 'r1', label: 'Room 3 turned over', depth: 0, photo: 'required', file: 'off', location: 'off', at: '08:12' },
            { id: 'r2', label: 'Sharps bin below fill line', depth: 1, photo: 'required', file: 'off', location: 'off', at: '08:13' },
            { id: 'r3', label: 'Oxygen cylinder above 50%', depth: 0, photo: 'offered', file: 'off', location: 'off', at: '08:20' },
            { id: 'r4', label: 'Crash trolley seal intact', depth: 0, photo: 'required', file: 'required', location: 'off', at: '08:26' },
          ],
        },
      ],
    },
  ],
};

const uz: Pack = {
  words: {
    photo: 'Surat',
    location: 'Joylashuv',
    file: 'Fayl',
    note: 'Izoh',
    required: 'majburiy',
    offered: 'taklif etiladi',
    off: 'oʻchirilgan',
    fileName: 'kalibrlash-sert-4471.pdf',
    everyone: 'Bu maydondagi hamma',
    sampleData: 'Namuna maʼlumot',
  },
  spaces: [
    {
      id: 'depot',
      name: 'Logistika ombori',
      kind: 'Bitta obyekt, ikki smena',
      members: [
        { initials: 'DK', name: 'D. Karimova' },
        { initials: 'ST', name: 'S. Toshmatov' },
        { initials: 'AR', name: 'A. Rahimov' },
      ],
      checklists: [
        {
          id: 'opening',
          name: 'Ochilish tekshiruvi · 2-liniya',
          every: 'Har kuni',
          at: '06:00',
          who: 'Bu maydondagi hamma',
          tasks: [
            { id: 't1', label: 'Sovuq ombor harorati qayd etildi', depth: 0, photo: 'required', file: 'required', location: 'offered', at: '06:14' },
            { id: 't2', label: 'Koʻrsatkich meʼyorda', depth: 1, photo: 'off', file: 'off', location: 'off', at: '06:14' },
            { id: 't3', label: 'Ikkala arrada himoya oʻrnatilgan', depth: 0, photo: 'required', file: 'off', location: 'off', at: '06:15' },
            { id: 't4', label: 'Chiqindi idishlari boʻshatildi', depth: 0, photo: 'off', file: 'off', location: 'off', at: '06:31' },
          ],
        },
      ],
    },
    {
      id: 'cafe',
      name: 'Qahvaxonalar tarmogʻi',
      kind: 'Toʻrt filial, bitta tartib',
      members: [
        { initials: 'NB', name: 'N. Bekmurodova' },
        { initials: 'IY', name: 'I. Yusupov' },
      ],
      checklists: [
        {
          id: 'open',
          name: 'Ochilish · 3-filial',
          every: 'Har kuni',
          at: '07:30',
          who: 'Bu maydondagi hamma',
          tasks: [
            { id: 'c1', label: 'Zal mijozlarga tayyor', depth: 0, photo: 'required', file: 'off', location: 'required', at: '07:41' },
            { id: 'c2', label: 'Vitrina toʻldirilgan va sanasi qoʻyilgan', depth: 1, photo: 'required', file: 'off', location: 'off', at: '07:44' },
            { id: 'c3', label: 'Qahva tegirmoni sozlangan', depth: 0, photo: 'off', file: 'off', location: 'off', at: '07:52' },
            { id: 'c4', label: 'Muzlatgich harorati yozildi', depth: 0, photo: 'required', file: 'required', location: 'off', at: '07:58' },
          ],
        },
      ],
    },
    {
      id: 'clinic',
      name: 'Klinika',
      kind: 'Uch xona, kunlik tayyorgarlik',
      members: [
        { initials: 'MA', name: 'M. Aliyeva' },
        { initials: 'RS', name: 'R. Saidov' },
        { initials: 'GN', name: 'G. Nazarova' },
      ],
      checklists: [
        {
          id: 'rooms',
          name: 'Xona tayyorligi · 3-boʻlim',
          every: 'Har kuni',
          at: '08:00',
          who: '3 ta tanlangan kishi',
          tasks: [
            { id: 'r1', label: '3-xona tozalandi', depth: 0, photo: 'required', file: 'off', location: 'off', at: '08:12' },
            { id: 'r2', label: 'Oʻtkir chiqindi idishi belgidan past', depth: 1, photo: 'required', file: 'off', location: 'off', at: '08:13' },
            { id: 'r3', label: 'Kislorod balloni 50% dan yuqori', depth: 0, photo: 'offered', file: 'off', location: 'off', at: '08:20' },
            { id: 'r4', label: 'Shoshilinch aravacha plombasi butun', depth: 0, photo: 'required', file: 'required', location: 'off', at: '08:26' },
          ],
        },
      ],
    },
  ],
};

const ru: Pack = {
  words: {
    photo: 'Фото',
    location: 'Локация',
    file: 'Файл',
    note: 'Примечание',
    required: 'обязательно',
    offered: 'предлагается',
    off: 'выключено',
    fileName: 'sertifikat-poverki-4471.pdf',
    everyone: 'Все в этом пространстве',
    sampleData: 'Демо-данные',
  },
  spaces: [
    {
      id: 'depot',
      name: 'Логистический склад',
      kind: 'Один объект, две смены',
      members: [
        { initials: 'ДК', name: 'Д. Каримова' },
        { initials: 'СТ', name: 'С. Тошматов' },
        { initials: 'АР', name: 'А. Рахимов' },
      ],
      checklists: [
        {
          id: 'opening',
          name: 'Проверка при открытии · Линия 2',
          every: 'Каждый день',
          at: '06:00',
          who: 'Все в этом пространстве',
          tasks: [
            { id: 't1', label: 'Температура холодного склада записана', depth: 0, photo: 'required', file: 'required', location: 'offered', at: '06:14' },
            { id: 't2', label: 'Показание в пределах нормы', depth: 1, photo: 'off', file: 'off', location: 'off', at: '06:14' },
            { id: 't3', label: 'Защита установлена на обеих пилах', depth: 0, photo: 'required', file: 'off', location: 'off', at: '06:15' },
            { id: 't4', label: 'Мусорные баки опорожнены', depth: 0, photo: 'off', file: 'off', location: 'off', at: '06:31' },
          ],
        },
      ],
    },
    {
      id: 'cafe',
      name: 'Сеть кофеен',
      kind: 'Четыре точки, один порядок',
      members: [
        { initials: 'НБ', name: 'Н. Бекмуродова' },
        { initials: 'ИЮ', name: 'И. Юсупов' },
      ],
      checklists: [
        {
          id: 'open',
          name: 'Открытие · Точка 3',
          every: 'Каждый день',
          at: '07:30',
          who: 'Все в этом пространстве',
          tasks: [
            { id: 'c1', label: 'Зал готов к гостям', depth: 0, photo: 'required', file: 'off', location: 'required', at: '07:41' },
            { id: 'c2', label: 'Витрина заполнена, даты проставлены', depth: 1, photo: 'required', file: 'off', location: 'off', at: '07:44' },
            { id: 'c3', label: 'Кофемолка настроена', depth: 0, photo: 'off', file: 'off', location: 'off', at: '07:52' },
            { id: 'c4', label: 'Температура холодильников записана', depth: 0, photo: 'required', file: 'required', location: 'off', at: '07:58' },
          ],
        },
      ],
    },
    {
      id: 'clinic',
      name: 'Клиника',
      kind: 'Три кабинета, ежедневная готовность',
      members: [
        { initials: 'МА', name: 'М. Алиева' },
        { initials: 'РС', name: 'Р. Саидов' },
        { initials: 'ГН', name: 'Г. Назарова' },
      ],
      checklists: [
        {
          id: 'rooms',
          name: 'Готовность кабинетов · Отделение 3',
          every: 'Каждый день',
          at: '08:00',
          who: '3 названных человека',
          tasks: [
            { id: 'r1', label: 'Кабинет 3 подготовлен', depth: 0, photo: 'required', file: 'off', location: 'off', at: '08:12' },
            { id: 'r2', label: 'Контейнер для острого ниже отметки', depth: 1, photo: 'required', file: 'off', location: 'off', at: '08:13' },
            { id: 'r3', label: 'Кислородный баллон выше 50%', depth: 0, photo: 'offered', file: 'off', location: 'off', at: '08:20' },
            { id: 'r4', label: 'Пломба реанимационной тележки цела', depth: 0, photo: 'required', file: 'required', location: 'off', at: '08:26' },
          ],
        },
      ],
    },
  ],
};

export const DEMO: Record<BuiltinLocale, Pack> = { en, uz, ru };

/**
 * A nested procedure per space, for the hierarchy explorer.
 *
 * Kept separate from `checklists` because it is answering a different question.
 * The checklist in the hero shows what filling one in feels like; this shows how
 * deep a real procedure goes. Every space has one branch that runs the full five
 * levels the product allows, because a claim about depth that only ever shows
 * two levels is not a claim, it is a picture.
 */
export type ProcedureNode = {
  id: string;
  label: string;
  photo?: Requirement;
  location?: Requirement;
  children?: ProcedureNode[];
};
