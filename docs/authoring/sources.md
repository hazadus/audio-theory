# Рекомендуемые источники

Для вводного обзора прочитаны [JUCE: juce::ADSR](https://docs.juce.com/master/classjuce_1_1ADSR.html) (noteOn, noteOff, reset — запуск и завершение огибающей) и [Smith, гл. 27: Data Compression Strategies](https://www.dspguide.com/ch27/1.htm) (различие сжатия с потерями и без них). [SANDYNE Learn](https://sandyne.com/learn#oscillators) просмотрен как ориентир интерфейса опытов Oscillators, ADSR и LFOs; для технических утверждений использовать учебники и официальные руководства ниже.

Пополняемый список литературы для подготовки и дополнения материалов по [общим правилам](rules.md). Добавлять полезные источники после чтения: автор, название, ссылка и темы применения. Для конкретного утверждения проверять подходящий раздел и ссылаться на него в статье. Рекомендация не делает источник обязательным или единственным.

## Hugo Fastl, Eberhard Zwicker — Psychoacoustics: Facts and Models

3rd ed., Springer, 2007. ISBN 978-3-540-23159-2. Локальный PDF: `scratch/books/psychoacoustics_facts_and_models_springer_series_in_information.pdf`; обзор применения — в [каталоге книг](books.md#fastl-h-zwicker-e--psychoacoustics-facts-and-models-3rd-ed-springer-2007). Экспериментальные данные и инженерные модели слуха; подходит для проверки и дополнения статьи о психоакустике, объяснения восприятия модуляции и подготовки собственных аудиопримеров.

Прочитаны выбранные страницы при оценке книги; номера печатные:

- §1.3–1.4, с. 8–14 — процедуры сравнения, статистические пороги и зависимость результата от метода.
- §4.2.1, с. 67–68, и §4.4.2–4.4.3, с. 82–84 — биения и комбинационные тоны при измерении маскировки, пред- и постмаскировка с условиями опытов.
- §5.3–5.4, с. 119–123, и §5.7, с. 135–136 — виртуальная высота, негармонические комплексы и выраженность высоты.
- §6.2, с. 158; §7.1.2, с. 180–181; §7.2.2, с. 186 — критическая полоса, различимость уровня и частоты, влияние длительности, различие сравнения тонов и обнаружения модуляции.
- §8.2, с. 205–207; §8.4–8.5, с. 214–218; выбранные страницы §8.7, с. 220, 223, 226–227 — пределы правила «+10 дБ — вдвое громче», частичная маскировка, временное накопление громкости и удельная громкость.
- Начала гл. 9–11, с. 239–240, 247–249, 257–259 — резкость, сила флуктуаций и шероховатость; график рис. 11.2 проверен визуально.
- Описания демонстраций, с. 452–459 — параметры опытов с виртуальной высотой, различимыми изменениями, частичной маскировкой, длительностью, пульсацией и шероховатостью. Аудиофайлы не прослушивались.

Графики рис. 5.11 и 8.3 также проверены визуально. Для статьи сохранять условия измерений и различать экспериментальные результаты и модели. Старые стандартные кривые из книги не заменяют используемые данные ISO 226:2023.

При дополнении статьи о психоакустике также прочитаны §5.4, с. 124 (модель виртуальной высоты и октавная неоднозначность), и оставшиеся страницы §8.7 до с. 227 (удельная громкость и сложение вкладов). В статью перенесены условия различимости уровня и частоты, пределы правила удвоения громкости, влияние длительности и частичной маскировки, ограничения объяснения высоты через НОД, сила флуктуаций и шероховатость. Новые математические формулы моделей не вводятся.

## Robert Hutchinson — Music Theory for the 21st-Century Classroom

[Онлайн-учебник музыкальной теории](https://musictheory.pugetsound.edu/mt21c/MusicTheory.html), University of Puget Sound. Добавлен по рекомендации автора проекта. Подходит для музыкальных пояснений к высоте тона, обозначениям нот и октав, интервалам, темпу и ритму; упражнения с прослушиванием полезны как образец подачи аудиопримеров и самопроверки.

Прочитанные при знакомстве с учебником разделы:

- [§1.1. Pitch](https://musictheory.pugetsound.edu/mt21c/Pitch.html) и [§1.3. Octave Registers](https://musictheory.pugetsound.edu/mt21c/OctaveRegisters.html) — высота, названия нот, обозначения регистров и расположение нот на клавиатуре.
- [§5.1. Introduction to Intervals](https://musictheory.pugetsound.edu/mt21c/IntervalsIntroduction.html) — мелодические и гармонические интервалы, их числовая величина и качество.
- [§4.4. Meter](https://musictheory.pugetsound.edu/mt21c/meter.html) — пульс, темп в BPM, метр и деление долей; музыкальная основа для объяснения синхронизации LFO и задержки с темпом.
- [§4.7. Practice Exercises](https://musictheory.pugetsound.edu/mt21c/BasicsOfRhythmPracticeExercises.html) — определение метра на слух и упражнения с ответами.
- [§35.2. Phase Shifting](https://musictheory.pugetsound.edu/mt21c/PhaseShifting.html) — постепенное расхождение повторяющихся паттернов и дискретные сдвиги; различие приёмов в Piano Phase и Clapping Music Стива Райха. При использовании различать фазу ритмического цикла и фазу звуковой волны.
- [§15.1. The Elements of Music](https://musictheory.pugetsound.edu/mt21c/The-Elements-of-Music.html) — тембр, динамика, регистр, артикуляция и другие средства музыкального контраста.

Для формул перевода нот в частоты и MIDI, акустических утверждений и реализации DSP нужны дополнительные технические источники. Учебник опубликован под [GNU Free Documentation License 1.2 или более поздней версией](https://musictheory.pugetsound.edu/mt21c/frontmatter-3.html); при переносе текста или иллюстраций учитывать условия лицензии.

При дополнении статьи о психоакустике повторно проверены §1.3 и §5.1: обозначения нот и регистров, мелодические и гармонические интервалы. Музыкальные объяснения пересказаны своими словами; текст и иллюстрации учебника не копировались.

## Jay Abramson и соавторы — OpenStax, Precalculus 2e

Учебник с объяснениями и упражнениями; прочитанные при подготовке [математического минимума](../../src/content/articles/audio-math.mdx) разделы:

- [§1.1. Functions and Function Notation](https://openstax.org/books/precalculus-2e/pages/1-1-functions-and-function-notation) — функция, аргумент, чтение обозначений и кусочные правила.
- [§5.1. Angles](https://openstax.org/books/precalculus-2e/pages/5-1-angles) — радианы, длина дуги, перевод градусов и направление угла.
- [§5.4. Right Triangle Trigonometry](https://openstax.org/books/precalculus-2e/pages/5-4-right-triangle-trigonometry) и [§5.2. Unit Circle: Sine and Cosine Functions](https://openstax.org/books/precalculus-2e/pages/5-2-unit-circle-sine-and-cosine-functions) — отношения сторон, координаты на окружности и значения синуса и косинуса.
- [§4.3. Logarithmic Functions](https://openstax.org/books/precalculus-2e/pages/4-3-logarithmic-functions) и [§4.5. Logarithmic Properties](https://openstax.org/books/precalculus-2e/pages/4-5-logarithmic-properties) — десятичный и натуральный логарифмы, допустимые аргументы, произведение, частное и степень.
- [§4.1. Exponential Functions](https://openstax.org/books/precalculus-2e/pages/4-1-exponential-functions) — основания степеней, число e, экспоненциальный рост и спад.

Подходит для объяснения базовой математики до её применения к аудио. Рисунки статьи собственные; иллюстрации учебника не копируются.

## Steven W. Smith — The Scientist and Engineer's Guide to Digital Signal Processing

[Книга, глава 1 и оглавление](https://www.dspguide.com/ch1.htm). Рекомендована автором проекта. Подходит для основ цифровой обработки сигналов, дискретизации, АЦП/ЦАП, представления чисел, спектрального анализа и фильтров. Выбирать главу по теме; не переносить утверждения из обзорной главы на специальные вопросы без проверки.

Прочитанные при подготовке шаблона разделы:

- [Глава 1: The Breadth and Depth of DSP](https://www.dspguide.com/ch1.htm) — область применения DSP и устройство книги.
- [Глава 3: The Sampling Theorem](https://www.dspguide.com/ch3/2.htm) — отсчёты, частота дискретизации и условия восстановления сигнала.
- [Глава 3.1: Quantization](https://www.dspguide.com/ch3/1.htm) — аналоговый сигнал как напряжение во времени; дискретизация и квантование как отдельные шаги.
- [Глава 22.1: Human Hearing](https://www.dspguide.com/ch22/1.htm) — диапазон слышимых частот, область наибольшей чувствительности, устройство уха.

Прочитанные при подготовке статьи о дискретизации разделы:

- [Глава 3.4: Analog Filters for Data Conversion](https://www.dspguide.com/ch3/4.htm) — антиалиасинговый фильтр нижних частот перед АЦП.
- [Глава 22.3: Audio Processing](https://www.dspguide.com/ch22/3.htm) — частоты дискретизации компакт-диска (44,1 кГц) и телефонной связи (8 кГц), полоса речи и музыки.

Прочитанный при подготовке статьи об АЦП и ЦАП раздел:

- [Глава 3.3: Digital-to-Analog Conversion](https://www.dspguide.com/ch3/3.htm) — удержание уровня, спектральные копии, восстановительный фильтр и компенсация частотной характеристики удержания.

Прочитанные разделы о представлении отсчётов в программах:

- [Глава 4.3: Floating Point (Real Numbers)](https://www.dspguide.com/ch4/3.htm) — знак, значащая часть и степень, форматы 32 и 64 бита. Для статьи используется описание устройства формата; крайние значения и специальные числа здесь не разбираются.
- [Глава 4.4: Number Precision](https://www.dspguide.com/ch4/4.htm) — неравномерный шаг представимых чисел, округление десятичных дробей и результатов арифметики.

## JUCE — аудиобуферы и обработка блоками

Официальная документация C++-фреймворка; API сверено с исходниками стабильного релиза [9.0.3](https://github.com/juce-framework/JUCE/releases/tag/9.0.3).

- [AudioBuffer](https://docs.juce.com/master/classjuce_1_1AudioBuffer.html) и [заголовок версии 9.0.3](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_basics/buffers/juce_AudioSampleBuffer.h) — конструктор, неопределённое начальное содержимое, `clear`, `getNumChannels`, число отсчётов на канал в `getNumSamples`, указатели на отдельные каналы, `setSample`.
- [AudioProcessor, processBlock](https://docs.juce.com/master/classjuce_1_1AudioProcessor.html) — входные и выходные каналы, ограничения записи, переменная длина и нулевые блоки. Подходит для объяснения обратного вызова и границ обработки.

## JUCE и Ableton — LFO и генерация волн

Прочитаны при подготовке статьи по [issue #5](https://github.com/hazadus/audio-theory/issues/5):

- [Рабочий текст стандарта C++. Mathematical constants](https://eel.is/c++draft/numbers) и [WG21 P0631R8. Math Constants](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2019/p0631r8.pdf) — заголовок `<numbers>` и стандартная константа `std::numbers::pi`, добавленные в C++20.
- [JUCE. Oscillator](https://docs.juce.com/master/classjuce_1_1dsp_1_1Oscillator.html) и [исходник 9.0.3](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_dsp/widgets/juce_Oscillator.h) — функция формы, диапазон передаваемой фазы, прибавление генератора к входу, таблица значений, подготовка, сброс и сглаживание частоты за 50 мс.
- [JUCE. Phase](https://docs.juce.com/master/structjuce_1_1dsp_1_1Phase.html) и [исходник 9.0.3](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_dsp/maths/juce_Phase.h) — фазовый аккумулятор, перенос с сохранением избытка, возврат фазы до её увеличения.
- [JUCE. ProcessSpec](https://docs.juce.com/master/structjuce_1_1dsp_1_1ProcessSpec.html) — частота дискретизации, размер блока и число каналов.
- [JUCE. Introduction to DSP](https://juce.com/tutorials/tutorial_dsp_introduction/) — прочитаны The signal processing lifecycle, Creating an oscillator и Changing the oscillator waveform: подготовка, синусоида, пила и интерполяция таблицы.
- [JUCE. Chorus](https://docs.juce.com/master/classjuce_1_1dsp_1_1Chorus.html) — модуляция времени задержки синусоидальным LFO; применение к хорусу и фленжеру.
- [Ableton. Live 12 Manual, Live Instrument Reference](https://www.ableton.com/en/live-manual/12/live-instrument-reference/) — прочитаны Analog: Architecture, Oscillators, Filters, Amplifiers, LFOs, Global Parameters и Operator: LFO Section, LFO Range. Маршруты модуляции, формы, заполнение импульса, фазовый сдвиг, свободное движение и перезапуск; частотные режимы LFO вплоть до звукового диапазона.

## ALSA Project и PortAudio — кадры, раскладки и аудиопотоки

- [ALSA Project. PCM (digital audio) interface](https://www.alsa-project.org/alsa-doc/alsa-lib/pcm.html) — прочитаны описание отсчёта и кадра, General overview, Access modes и Error codes: кадр объединяет каналы одного момента, раздельное и чередующееся хранение, underrun и overrun.
- [PortAudio. API Overview](https://portaudio.com/docs/v19-doxydocs/api_overview.html) — прочитаны общий обзор, Callback I/O Method и Retrieving Stream Information: форматы и раскладки данных, передача буферов, ограничения обработчика реального времени и фактические задержки потока.

## Walt Kester — руководства Analog Devices по преобразователям

- [MT-001: Taking the Mystery out of the Infamous Formula, “SNR = 6.02N + 1.76dB,” and Why You Should Care](https://www.analog.com/media/en/training-seminars/tutorials/MT-001.pdf) — прочитаны с. 1–3: ошибка идеального равномерного квантования в половину шага, модель некоррелированного шума, расчёт SNR для синусоиды полной шкалы во всей полосе Найквиста.
- [MT-017: Oversampling Interpolating DACs](https://www.analog.com/media/en/training-seminars/tutorials/mt-017.pdf) — прочитаны с. 1–2: спектральные копии и спад частотной характеристики при удержании, передискретизация и цифровая интерполяция для упрощения аналогового восстановительного фильтра.

## Carl R. Nave — HyperPhysics

[Раздел о звуке](https://hyperphysics.gsu.edu/hbase/Sound/soucon.html). Справочник по физике (Georgia State University) с короткими страницами и формулами. Подходит для основ акустики: скорость звука, волновые соотношения, интенсивность и порог слышимости, микрофоны.

Прочитанные при подготовке статьи о звуковой волне страницы:

- [Speed of Sound](https://hyperphysics.gsu.edu/hbase/Sound/souspe.html) — скорость звука в сухом воздухе, приближённая зависимость от температуры, независимость от частоты и амплитуды.
- [Wave Relationship](https://hyperphysics.gsu.edu/hbase/wavrel.html) — λ = vT и v = fλ.
- [Sound Intensity](https://hyperphysics.gsu.edu/hbase/Sound/intens.html) — порог слышимости 20 мкПа, условный болевой порог.
- [Microphones](https://hyperphysics.gsu.edu/hbase/Audio/mic.html) — динамический и конденсаторный микрофоны, выходной сигнал повторяет звуковое давление.

## Julius O. Smith III — Mathematics of the Discrete Fourier Transform

[Онлайн-книга](https://ccrma.stanford.edu/~jos/mdft/) (CCRMA, Stanford University). Подходит для обозначений и математики дискретных сигналов: отсчёты, период и частота дискретизации, теорема отсчётов, ДПФ.

Прочитанные при подготовке статьи о дискретизации страницы:

- [DFT Definition](https://ccrma.stanford.edu/~jos/mdft/DFT_Definition.html) — обозначения $t_n = nT$, $f_s = 1/T$, единицы.
- [Introduction to Sampling](https://ccrma.stanford.edu/~jos/mdft/Introduction_Sampling.html) — отсчёт как число, частота компакт-диска 44 100 отсчётов в секунду.
- [Sampling Theory](https://ccrma.stanford.edu/~jos/mdft/Sampling_Theory.html) — восстановление сигнала с ограниченным спектром по отсчётам, термин Nyquist rate.

Прочитанные при подготовке раздела о наложении спектров страницы:

- [Sampling Theorem](https://ccrma.stanford.edu/~jos/mdft/Sampling_Theorem.html) — формулировка теоремы со строгим условием, восстановление через sinc, почему исключена частота $f_s/2$.
- [Aliasing of Sampled Signals](https://ccrma.stanford.edu/~jos/mdft/Aliasing_Sampled_Signals.html) — перенос частоты выше $f_s/2$, ограничения простого описания «зеркалом».

Прочитанные при подготовке статьи об уровне сигнала страницы:

- [Decibels](https://ccrma.stanford.edu/~jos/mdft/Decibels.html) — множители 20 для амплитуды и 10 для мощности, роль опорной величины.
- [Properties of dB Scales](https://ccrma.stanford.edu/~jos/mdft/Properties_DB_Scales.html) — удвоение амплитуды ≈ 6 дБ, мощности ≈ 3 дБ.
- [dB Full Scale (dBFS)](https://ccrma.stanford.edu/~jos/mdft/DB_Full_Scale_dBFS.html) — наибольшая амплитуда как опорный уровень 0 дБ.
- [Signal Metrics](https://ccrma.stanford.edu/~jos/mdft/Signal_Metrics.html) — средняя мощность, уровень RMS, мощность $A^2/2$ вещественной синусоиды.
- [Dynamic Range](https://ccrma.stanford.edu/~jos/mdft/Dynamic_Range.html) — динамический диапазон системы и сигнала.

Прочитанные при подготовке раздела о фазе страницы:

- [Sinusoids](https://ccrma.stanford.edu/~jos/mdft/Sinusoids.html) — $x(t) = A \sin(\omega t + \varphi)$, начальная фаза (phase offset) и мгновенная фаза $\omega t + \varphi$ в радианах, обычный диапазон $[-\pi, \pi)$ или $[0, 2\pi)$.
- [Sinusoids at the Same Frequency](https://ccrma.stanford.edu/~jos/mdft/Sinusoids_Same_Frequency.html) — задержка на $t_1$ меняет фазу на $\omega t_1$; сумма сдвинутых копий синусоиды — синусоида той же частоты.
- [Projection of Circular Motion](https://ccrma.stanford.edu/~jos/mdft/Projection_Circular_Motion.html) — косинус и синус как проекции равномерного движения по окружности на оси.

## Александр Радзишевский — «Звук: немного теории» (WebSound.ru)

[Статья для журнала Upgrade, февраль 2005](https://web.archive.org/web/20240416203925/http://websound.ru/articles/theory/sound-theory.htm) (веб-архив). Обзор от физики и психофизики звука до цифровых сигналов и кодеков на русском языке. Подходит как карта тем и источник русской терминологии: звуковая волна и её свойства (интерференция, дифракция, резонанс, эффект Доплера, реверберация), спектр, психоакустика, дискретизация, линейное квантование, кодирование. Статья 2005 года, числа вроде «около 330 м/с» приближённые, воспроизведение без разрешения авторов запрещено — пересказывать своими словами, конкретные значения проверять по первичным источникам выше.

Прочитанные разделы: оглавление, 2.1 «Физика звуковой волны» (волна как перенос возмущения, зависимость скорости звука от среды, независимость от частоты, интерференция и биения, дифракция, резонанс), в части цифрового звука — определения теоремы Котельникова (в зарубежной литературе Шеннона) и квантования по амплитуде, уровней и шага квантования. Разделы о психоакустике, кодеках и пространственном звуке не читались.

## Habr — Felix Arutiunyan, «Цифровое представление аналогового аудиосигнала. Краткий ликбез»

[Статья на Хабре, 25 мая 2020](https://habr.com/ru/articles/503786/). Вводный текст для начинающих с рисунками и аудиопримерами: отличие аналогового и цифрового сигнала, дискретизация и квантование, разрядность, частота дискретизации, теорема Котельникова, алиасинг, битрейт, форматы хранения. Подходит для сверки русских формулировок и расчётов (число уровней $N = 2^n$, битрейт CD $44\,100 \times 16 \times 2 = 1411{,}2$ кбит/с) и как идеи примеров для статей о дискретизации, разрядности и битрейте.

Осторожно с утверждениями: верхняя граница слуха указана непоследовательно (20 кГц и 16 кГц), объяснение 44,1 кГц через PAL/NTSC не раскрыто, пример маскировки (80 дБ на 1 кГц маскирует 40 дБ на 2 кГц) упрощён. Для таких мест брать числа из Smith и Julius O. Smith выше.

## Desmos — «Digital signal»

[Интерактивный график](https://www.desmos.com/calculator/aojmanpjrl) (автор не указан, создан в 2015). Модель оцифровки: аналоговый сигнал — сумма двух синусоид $a \sin(2\pi f x - c)$ с настраиваемыми амплитудой, частотой и фазой; ползунки частоты дискретизации и разрядности (по умолчанию 16 бит) строят точки дискретного сигнала с округлением до уровней квантования. Подходит как образец для интерактива о дискретизации, алиасинге и квантовании: при низкой частоте дискретизации и малой разрядности хорошо видны наложение и ступенчатая погрешность. Страница требует JavaScript; формулы читаются и из JSON состояния графика. Код проекта не копировать — повторять идею, а числа и формулировки проверять по первичным источникам.

## Daniel A. Russell — Acoustics and Vibration Animations

[Wave Motion in Mechanical Medium](https://www.acs.psu.edu/drussell/Demos/waves/wavemotion.html) (Penn State). Анимации продольных и поперечных волн: частицы колеблются около положения равновесия, сжатия и разрежения.

## MathWorks — Audio Toolbox: динамическая обработка

Документация MATLAB с алгоритмами в формулах; в разделах ссылки на Giannoulis, Massberg, Reiss, «Digital Dynamic Range Compressor Design — A Tutorial and Analysis», JAES 60(6), 2012 (сама статья при подготовке была недоступна: страница автора на сайте QMUL переехала, открытого PDF нет). Подходит для статической характеристики, колена, сглаживания и определений времени атаки и восстановления.

- [compressor](https://www.mathworks.com/help/audio/ref/compressor-system-object.html) — характеристика с жёстким и мягким коленом шириной W вокруг порога, сглаживание подавления с $\alpha = e^{-\ln 9/(f_s t)}$, время атаки и восстановления как переход от 10 до 90 %, автоматическая компенсация, вход боковой цепи `EnableSidechain` (уровень по второму входу, усиление к первому) и пример приглушения гитары речью.
- [limiter](https://www.mathworks.com/help/audio/ref/limiter-system-object.html) — выход выше порога равен порогу.
- [expander](https://www.mathworks.com/help/audio/ref/expander-system-object.html) — ниже порога $y = T + (x - T) R$.
- [noiseGate](https://www.mathworks.com/help/audio/ref/noisegate-system-object.html) — нулевое усиление ниже порога, время удержания.

## W3C — Web Audio API: DynamicsCompressorNode

[Раздел спецификации](https://webaudio.github.io/web-audio-api/#DynamicsCompressorNode). Параметры компрессора браузера: колено выше порога (от T до T + knee), атака и восстановление как время изменения усиления на 10 дБ, фиксированная задержка 6 мс для взгляда вперёд, автоматическая компенсация. Полезно как пример того, что определения параметров различаются между реализациями.

## Wikipedia — DBFS и «Компрессор аудиосигнала»

[DBFS](https://en.wikipedia.org/wiki/DBFS) — 0 dBFS как наибольший цифровой уровень, соглашение AES17 (RMS синусоиды с полной амплитудой — 0 dBFS, прямоугольной волны — +3 dBFS), около 96 дБ у 16 бит; сам стандарт AES17 не читался. [Компрессор аудиосигнала](https://ru.wikipedia.org/wiki/Компрессор_аудиосигнала) — русские названия параметров (порог, степень сжатия, время атаки) и пример сжатия 2:1.

Прочитаны при дополнении статьи о компрессоре разделом о боковой цепи:

- [Wikipedia. Dynamic range compression, раздел Side-chaining](https://en.wikipedia.org/wiki/Dynamic_range_compression#Side-chaining) — определение входа боковой цепи, приглушение музыки голосом ведущего, бас и бочка, деэссер с диапазоном сибилянтов 6–9 кГц (по статье Mike Senior в Sound on Sound, 2009, не читалась).
- Roey Izhaki. Mixing Audio, 2nd ed., Focal Press, 2012 — гл. 16, с. 288–289 (внешний вход и фильтр боковой цепи), с. 306–308 (низкие частоты сильнее запускают сжатие, фильтр верхних частот в боковой цепи и его влияние на тембр), с. 316 (деэссер на компрессоре и его ограничения), с. 317 (сжатие органа по бочке, компрессор против дакера); гл. 20, с. 370–372 (характеристика дакера с постоянной глубиной, приглушение музыки голосом, атака, восстановление, взгляд вперёд).

## Уровни в децибелах и калибровка RMS

[Sengpiel Audio. Calculation of voltage levels in dB](https://sengpielaudio.com/calculator-db-volt.htm) — формулы дБu (0,775 В), дБV (1 В), дБ и дБм для мощности, опорные величины (20 мкПа, 10⁻¹² Вт/м²), таблица профессиональных (+4 дБu = 1,228 В) и бытовых (−10 дБV = 0,316 В) уровней, связь пиковых и RMS-значений напряжения. Справочный сайт одного автора: числа сверять со стандартами.

[Sengpiel Audio. Sound pressure level and addition of levels](https://sengpielaudio.com/calculator-spl.htm) — SPL и уровень интенсивности, ΔL = 10 lg n при сложении n одинаковых некогерентных источников (+3,01 дБ для двух, +6,02 дБ для четырёх), 1 Па = 94 дБ SPL. Страница расстояния и закона обратных квадратов не читалась; формула суммы разных уровней на странице дана картинкой.

[Production Advice. LUFS, dBFS, RMS](https://productionadvice.co.uk/lufs-dbfs-rms/) — калибровка RMS-измерителей по AES17 (синусоида с пиком 0 dBFS даёт 0 dBFS RMS), занижение показаний на 3 дБ при другой калибровке, проверка розовым шумом (около −11,5 dBFS RMS), список измерителей с разной калибровкой. Список привязан к версиям программ: для статей брать идею проверки, не перечень. Связь LUFS и RMS в тексте не выведена, она только в видео; числа сверять с AES17 и документами EBU.

Применение: врезка об RMS и разделы об измерителях в статье об уровне сигнала, сложение уровней в статье о микшировании, аналоговые уровни в материалах для звукорежиссёра.

## Digido — Bob Katz

Статьи Боба Каца на сайте его студии Digital Domain. Все страницы раздела [Articles](https://www.digido.com/articles/) помечены 6 апреля 2017 года — это дата переноса на сайт; год первой публикации брать из текста страницы или оригинала. Позиция Каца — мнение практика: подавать как мнение и подкреплять вторым источником. Прочитаны для статьи `/level-practices/`:

- [Level Practices (Part 1)](https://www.digido.com/portfolio-item/level-practices-part-1/) — дата первой публикации на странице не указана, по тексту конец 1990-х. Пик-фактор аналоговой (около 14 дБ) и несжатой цифровой (до 20 дБ) записи, разница громкости около 6 дБ при одинаковом пике; стандарт OVER Sony 1630 в три отсчёта (на странице указано 33 мкс, расчёт для 44,1 кГц даёт 68 мкс); отсутствие передачи OVER по AES/EBU и S/PDIF; опорные уровни 0 VU = −20, −18 и −14 dBFS с рекомендациями для вещания, студий записи и перезаписи; запас 5 дБ для аналогового PPM.
- [Level Practices (Part 2)](https://www.digido.com/portfolio-item/level-practices-part-2/) — «Updated from the article published in the September 2000 issue of the AES Journal», примечание от 05.12.2007. Недостатки VU-метра (300 мс, шкала около 13 дБ, ровная АЧХ); 83 дБ SPL Айоана Аллена (Dolby, середина 1970-х); измерения Каца 1993–1996 годов; шкалы K-20, K-14, K-12, калибровка розовым шумом −20 dBFS RMS на канал, коррекция C, Slow, узкополосный шум 500–2000 Гц; AES-17, интеграция 600 мс; цвета шкалы; версии K/ITU с фильтрами BS.1770.
- [Loudness War: Peace is Almost here!](https://www.digido.com/portfolio-item/loudness-war-peace-is-almost-here/) — обзор видео и докладов о войне громкости без технических подробностей; о K-системе, LUFS и R 128 не пишет. Для статьи не использована.

Русский перевод частей 1 и 2 — «Стыковка уровней в звукозаписи» (перевод В. А. Назарова), см. [каталог книг](books.md); при цитировании чисел сверять с оригиналом.

Второй источник по K-системе и OVER: [Hugh Robjohns. MeterPlugs K-Meter, Sound On Sound, 2014](https://www.soundonsound.com/reviews/meterplugs-k-meter) (83 дБ C, назначение шкал, режимы BS.1770 без интегральной громкости), [FabFilter Pro-L 2: Metering](https://www.fabfilter.com/help/pro-l/using/metering) (85 дБ SPL в своей реализации, соотношение с R 128), [Apogee Symphony I/O: Level Meters](https://knowledge.apogeedigital.com/symphony-i/o-working-with-front-panel-and-maestro-level-meters) (Over при трёх и более отсчётах), [ProSoundWeb. What Engineers Should Know About Meters, 2012](https://www.prosoundweb.com/in-the-studio-what-engineers-should-know-about-meters/2/) (счётчики отсчётов только для АЦП, пики между отсчётами). [EBU R68-2000](https://tech.ebu.ch/docs/r/r068.pdf) — опорный уровень на 18 дБ ниже наибольшего кодируемого значения. Документация Sony с порогом OVER PCM-1630 не найдена; [Wikipedia. PCM adaptor](https://en.wikipedia.org/wiki/PCM_adaptor) — назначение серии 1600 для мастеринга CD.

## Кривые равной громкости и слух

- [NERC Vocabulary Server. Sound pressure level in air](https://vocab.nerc.ac.uk/collection/P07/current/CFSN0309/) — прочитано определение SPL: 20 lg(p/p₀), среднеквадратичное давление, опора 2 × 10⁻⁵ Па в воздухе.

- [ISO 226:2023. Acoustics — Normal equal-loudness-level contours](https://www.iso.org/standard/83117.html) — условия сравнения чистых тонов: свободное поле, фронтальный источник, два уха, нормальный слух в возрасте 18–25 лет. Прочитан [открытый фрагмент](https://cdn.standards.iteh.ai/samples/83117/6afa5bd94e0e4f32812c28c3b0a7b8ac/ISO-226-2023.pdf): введение, разделы 1, 3 и 4, формула (1), таблица 1 и приложение A. По формуле и числовым коэффициентам построен собственный SVG; столбец `T_f` (порог слышимости, определение 3.7 — 50 % правильных обнаружений) использован для рисунков статьи о психоакустике. Сканы и рисунки стандарта не воспроизводятся.
- [Yôiti Suzuki, Hisashi Takeshima, Kenji Kurakata. Revision of ISO 226 “Normal Equal-Loudness-Level Contours” from 2003 to 2023 edition: The background and results, 2024](https://www.jstage.jst.go.jp/article/ast/45/1/45_e23.66/_article/-char/en) — прочитаны введение и разделы 2–3: фоны, измерения Флетчера — Мансона в наушниках с пересчётом в свободное поле, история стандартизации, формула 2023 года. Лицензия статьи — CC BY-ND 4.0; её иллюстрации не изменять и не использовать для производного рисунка.
- [Audio Engineering Society. Learn More: Equal loudness contours](https://aes.org/resources/audio-topics/loudness-project/learn-more/) — прочитан одноимённый раздел: частотная чувствительность слуха, изменение формы кривых с уровнем и воспринимаемого баланса музыки.
- [Steven W. Smith. Human Hearing, глава 22](https://www.dspguide.com/ch22/1.htm) — прочитан раздел об устройстве наружного, среднего и внутреннего уха, преобразовании колебаний в нервные сигналы и частотной избирательности.
- [Roland Sottek, Thiago Lobato, Moritz Bender, Julian Becker. Modeling the ISO 226:2023 equal-loudness-level contours by standardized loudness methods, Forum Acusticum 2023](https://dael.euracoustics.org/confs/fa2023/data/articles/000585.pdf) — прочитаны разделы 2–5: пересмотр ISO 226, частотные фильтры и нелинейность слуха, сравнение моделей для чистых тонов.

## Психоакустика и перцептивное кодирование

Прочитаны при подготовке статьи о психоакустике:

- [Ted Painter, Andreas Spanias. Perceptual Coding of Digital Audio. Proceedings of the IEEE, 88(4), 2000](https://www.cns.nyu.edu/~david/courses/perceptionGrad/Readings/PainterSpanias-ProcIEEE2000.pdf) — раздел II целиком: порог слышимости в тишине и формула (1), SPL и болевой порог, передача частоты в место на основной мембране, критические полосы (2), шкала барков (3), ERB (6) и таблица 1 с 25 идеализированными полосами; маскировка шум — тон и тон — шум с примерами рис. 8 (4 и 24 дБ), функция распространения (7) со склонами +25 и −10 дБ/Барк, пороги (8) и (9), допустимый уровень искажений; временная маскировка (около 1–2 мс до маскера, 50–300 мс после). Обзор для инженеров кодеков, а не для измерений слуха; формулы — модели, а не данные.
- [Karlheinz Brandenburg. MP3 and AAC Explained. AES 17th International Conference, 1999](https://www.iis.fraunhofer.de/content/dam/iis/de/doc/ame/conference/AES-17-Conference_mp3-and-AAC-explained_AES17.pdf) — разделы 1, 2, 5: устройство перцептивного кодера (банк фильтров, модель, квантование ниже порога маскировки), MPEG-1/2 Layer 3 и AAC, предэхо и короткие блоки, бессмысленность оценки по SNR, битрейты 1,33 и 1 бит на отсчёт, тесты прослушивания.
- [Julius O. Smith III, Jonathan S. Abel. The Bark Frequency Scale](https://ccrma.stanford.edu/~jos/bbt/Bark_Frequency_Scale.html) — 24 критические полосы, их границы и средние частоты.
- [Carl R. Nave. HyperPhysics](https://hyperphysics.gsu.edu/hbase/Sound/earsens.html) — прочитаны страницы [Sensitivity of Human Ear](https://hyperphysics.gsu.edu/hbase/Sound/earsens.html) (динамический диапазон 0–130 дБ, различение 440 и 441 Гц), [Loudness](https://hyperphysics.gsu.edu/hbase/Sound/loud.html) (правило удвоения громкости при 10-кратной мощности и его ограничения), [Phons and Sones](https://hyperphysics.gsu.edu/hbase/Sound/phon.html) (40 фон = 1 сон, удвоение на каждые 10 фон), [Pitch](https://hyperphysics.gsu.edu/hbase/Sound/pitch.html) (сдвиг высоты с уровнем по Терхардту), [Cents](https://hyperphysics.gsu.edu/hbase/Music/cents.html) (октава 1200 центов, полутон 100 центов).
- [William M. Hartmann, Eric J. Macaulay. Anatomical limits on interaural time differences: an ecological perspective. Frontiers in Neuroscience, 8, 2014](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2014.00034/full) — разделы Spherical Head Model и Human ITD Sensitivity: наибольшая межушная разность времени около 763 мкс для типичной головы, исчезновение чувствительности к разности по тонкой структуре около 1 500 Гц.
- [Wikipedia. Sound localization](https://en.wikipedia.org/wiki/Sound_localization) — раздел Duplex theory: межушные разности времени и уровня, частотные области (ниже 1 000 Гц и выше 1 500 Гц), звуковая тень головы, неоднозначность «спереди — сзади» и роль ушной раковины. Для числовых утверждений сверять с первичными источниками.

Прочитаны при дополнении статьи о психоакустике:

- Алдошина И. «Основы психоакустики», цикл статей журнала «Звукорежиссёр», 1999–2001 (локальный PDF, см. [каталог книг](books.md)) — прочитаны ч. 1 (высота, теории места и временная, пропущенная основная частота), ч. 4–5 (локализация, расстояние, эффект предшествования), ч. 6–7 (маскировка и её асимметрия, бинауральная демаскировка), ч. 9 (едва заметная разность уровня, часть текста в PDF обрывается), ч. 11–12 (громкость, сложение громкости в критических полосах), начало ч. 14.1 (определения тембра). Журнальный обзор с русской терминологией; числа сверять с первоисточниками. Не перенесены как расходящиеся с другими источниками: локализация тонов ниже 150 Гц «отсутствует» (у Блауэрта размытость для низких тонов единицы градусов), «обратная маскировка эффективнее прямой» (противоречит Painter, Spanias), шкала мелов.
- Блауэрт Й. «Пространственный слух», М.: Энергия, 1979 (распознанный текст в `scratch/books/ocr/`) — § 2.1 (размытость локализации, табл. 2), § 2.3.2 (расстояние до слухового образа, локализация внутри головы), § 3.1.2 (закон первой волны, порог эха), § 3.2.2 (бинауральная разность уровней маскировки). Подходит как первоисточник для пространственного слуха.
- Roey Izhaki. Mixing Audio: Concepts, Practices and Tools, 2nd ed., Focal Press, 2012 — гл. 2 (громче — значит лучше, маскировка в миксе), гл. 4 (эквализация в моно), гл. 6 (глубина), гл. 11 (окно Хааса, Haas trick, сложение в моно), гл. 14 и 16 (сравнение при одинаковой громкости). Практика сведения, а не психоакустические измерения.
- [Wikipedia. Missing fundamental](https://en.wikipedia.org/wiki/Missing_fundamental) — высота по наибольшему общему делителю, телефон и маленькие колонки.
- [Wikipedia. Precedence effect](https://en.wikipedia.org/wiki/Precedence_effect) — Уоллах (1949) и Хаас (1951), слияние до 1–5 мс для щелчков и до 40 мс для речи, запаздывающий звук до 10 дБ громче.

## Analog Devices и Cycling ’74 — тремоло и амплитудная модуляция

Прочитаны при подготовке статьи о тремоло:

- [Analog Devices. Tutorial: Implementing a Tremolo Effect](https://wiki.analog.com/resources/tools-software/sharc-audio-module/baremetal/tremelo-effect-tutorial) — разделы Tutorial Overview и Basic Tremolo with Fixed Parameters: управление амплитудой через LFO, формула с наибольшим усилением 1, одно управляющее значение для стереоканалов.
- [Cycling ’74. MSP Tutorial 9: Amplitude Modulation](https://docs.cycling74.com/legacy/max5/tutorials/msp-tut/mspchapter09.html) — смещение и масштабирование модулятора, глубина, различие AM и кольцевой модуляции, медленная пульсация и изменение тембра при высоких частотах управления. Шкала глубины в этом учебнике отличается от выбранной для статьи: полное ослабление достигается при 0,5.

## Формат WAV и RIFF

Прочитаны при подготовке статьи об устройстве WAV-файла:

- [IBM Corporation, Microsoft Corporation. Multimedia Programming Interface and Data Specifications 1.0, август 1991](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/Docs/riffmci.pdf) — первоисточник RIFF и WAVE. Гл. 2: чанк, `ckSize` без байта выравнивания, пропуск незнакомых чанков, `LIST`/`INFO` и строки ZSTR (с. 2-14), `JUNK` (с. 2-18). Гл. 3 с с. 3-22: обязательные `fmt ` и `data`, `fmt ` раньше `data`, формулы `nAvgBytesPerSec` и `nBlockAlign`, чередование каналов, 8 бит без знака и 9 бит и больше со знаком.
- [Peter Kabal (McGill University). Wave File Specifications](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/WAVE/WAVE.html) — сводная таблица полей `fmt ` для 16, 18 и 40 байт, когда нужен `WAVE_FORMAT_EXTENSIBLE`, чанк `fact` для форматов не-PCM.
- [Microsoft Learn. WAVEFORMATEX structure](https://learn.microsoft.com/en-us/windows/win32/api/mmreg/ns-mmreg-waveformatex) — назначение полей, `nBlockAlign` как размер кадра, что не может описать простой `WAVEFORMATEX`.
- [EBU Tech 3285. Specification of the Broadcast Wave Format, версия 2.0, 2011](https://tech.ebu.ch/docs/tech/tech3285.pdf) — разд. 2.1–2.3: порядок чанков BWF, частные чанки нужно сохранять, поля `bext` (602 байта до переменной истории обработки).
- [EBU Tech 3306. MBWF / RF64, 2009](https://tech.ebu.ch/docs/tech/tech3306v1_1.pdf) — разд. 3.4–3.5: причина предела 4 ГБ, `RF64`, `ds64`, значение −1 в 32-битных полях, `JUNK` не меньше 28 байт первым чанком как резерв.
- [JUCE 9.0.3. juce_WavAudioFormat.cpp](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_formats/codecs/juce_WavAudioFormat.cpp), [AudioFormatManager](https://docs.juce.com/master/classjuce_1_1AudioFormatManager.html), [AudioFormatReader](https://docs.juce.com/master/classjuce_1_1AudioFormatReader.html) — обход чанков с выравниванием, `JUNK` после заголовка при записи, код формата 1 для 24 бит без маски каналов, поля читателя и метод `read`.

## Stephen Davies — A Cool Brisk Walk Through Discrete Mathematics

Учебник дискретной математики на LibreTexts; прочитаны при подготовке раздела о системах счисления в [математическом минимуме](../../src/content/articles/audio-math.mdx):

- [§7.3. Hexadecimal (base 16)](https://math.libretexts.org/Bookshelves/Combinatorics_and_Discrete_Mathematics/A_Cool_Brisk_Walk_Through_Discrete_Mathematics_(Davies)/07:_Counting/7.3:_Hexadecimal_(base_16)) — позиционная запись, цифры A–F, перевод между основаниями.
- [§7.4. Binary (base 2)](https://math.libretexts.org/Bookshelves/Combinatorics_and_Discrete_Mathematics/A_Cool_Brisk_Walk_Through_Discrete_Mathematics_(Davies)/07:_Counting/7.4:_Binary_(base_2)) — бит, байт из 8 бит, 256 значений, шестнадцатеричная цифра как 4 бита, числа без знака и дополнительный код.

## Целочисленный PCM и преобразования чисел

Прочитаны при подготовке статьи по issue #12:

- [Steven W. Smith. Глава 4.2: Fixed Point (Integers)](https://www.dspguide.com/ch4/2.htm) — код со смещением, дополнительный код, знак и асимметрия диапазона; для WAV смещение проверять по спецификации формата.
- [libsndfile. FAQ, Q10](https://libsndfile.github.io/libsndfile/FAQ.html#Q010) — различие масштабов чтения и записи int ↔ нормированный float; не заменяет проверку конкретной версии.
- [Рабочий текст стандарта C++: Floating-integral conversions](https://eel.is/c++draft/conv.fpint), [Integral conversions](https://eel.is/c++draft/conv.integral), [Shift operators](https://eel.is/c++draft/expr.shift), [AND](https://eel.is/c++draft/expr.bit.and), [OR](https://eel.is/c++draft/expr.or), [Unary operators](https://eel.is/c++draft/expr.unary.op) — условия преобразований и побитовых операций; различать требования C++17 и C++20.
- [JUCE 9.0.3. AudioDataConverters](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_basics/buffers/juce_AudioDataConverters.h), [AudioData::Pointer](https://docs.juce.com/master/classjuce_1_1AudioData_1_1Pointer.html) — чтение и запись Int16/Int24, масштаб, границы и округление. Исходники изучены по локальной копии точного релиза.

## Форматы сжатия: AIFF, FLAC и MP3

Прочитаны при подготовке статьи по issue #14; локальные копии описаны в [каталоге](books.md#форматы-файлов-и-кодеки):

- [RFC 9639. Free Lossless Audio Codec (FLAC), IETF, 2024](https://www.rfc-editor.org/rfc/rfc9639) — разд. 1, 3–5, 7–9: определения сжатия без потерь и с потерями, этапы кодера, середина и разность, фиксированные и линейные предсказатели (табл. 20), коды Райса и свёртка знака с примером, `STREAMINFO` и MD5, заголовок кадра, потоковое подмножество.
- [Apple Computer. AIFF 1.3, 1989](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/Docs/AIFF-1.3.pdf) и [AIFF-C, черновик 1991](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/Docs/AIFF-C.9.26.91.pdf) — чанки `FORM`, `COMM`, `SSND`, `FVER`, порядок байтов 68000, 80-битная частота, выравнивание отсчётов, коды сжатия.
- [Peter Kabal (McGill University). AIFF / AIFF-C Sound File Specifications](https://www.mmsp.ece.mcgill.ca/Documents/AudioFormats/AIFF/AIFF.html) — сводка кодов сжатия AIFF-C, `sowt`, отличия AIFF и AIFF-C.
- [Wikipedia. Extended precision](https://en.wikipedia.org/wiki/Extended_precision#x86_extended-precision_format) — устройство 80-битного числа x86 / SANE: смещение показателя 16383, явный целый бит.
- [Karlheinz Brandenburg. MP3 and AAC Explained, AES 17th Conference, 1999](https://www.iis.fraunhofer.de/content/dam/iis/de/doc/ame/conference/AES-17-Conference_mp3-and-AAC-explained_AES17.pdf) — дополнительно к разделам, прочитанным для психоакустики: разд. 3 (режимы, частоты, битрейты, гибридный банк фильтров, вложенные циклы), 4 (отличия AAC), 5.1–5.8 (артефакты, ограничение полосы, битрейт и качество), 6.1 (заголовок кадра и синхронизация).
- [Rassol Raissi. The Theory Behind Mp3, 2002](http://www.mp3-tech.org/programmer/docs/mp3_theory.pdf) — разд. 5–6: кадр и гранулы, поля заголовка и побочной информации, `main_data_begin`, области таблиц Хаффмана, ID3, переключение окон. Содержит неточности (бит защиты, длина заголовка), числа сверять.
- [Predrag Supurovic. MPEG Audio Frame Header, 1998](http://www.datavoyage.com/mpgscript/mpeghdr.htm) — побитовая схема заголовка, таблицы битрейтов и частот, бит защиты, расширение режима, формула длины кадра.
- [Martijn van Beurden. Lossless audio codec comparison, revision 6, CDDA](http://www.audiograaf.nl/losslesstest/Lossless%20audio%20codec%20comparison%20-%20revision%206%20-%20cdda.html) — средний размер FLAC, ALAC и других кодеков без потерь на 64 записях CD и время кодирования.
- [RFC 6716. Definition of the Opus Audio Codec, IETF, 2012](https://www.rfc-editor.org/rfc/rfc6716) — разд. 2: битрейты, полосы, слои SILK и CELT, длительности кадров.
- [Apple. ALAC, ReadMe исходных текстов](https://github.com/macosforge/alac) — разрядность, частоты, каналы и размер пакета Apple Lossless.
- [Wikipedia. Finite difference](https://en.wikipedia.org/wiki/Finite_difference) — разности назад и высших порядков, постоянная разность многочлена; для математической справки.

## Микширование сигналов

Прочитаны при подготовке `/mixing/`:

- [Steven W. Smith. Requirements for Linearity, глава 5.2](https://www.dspguide.com/ch5/2.htm) и [Static Linearity and Sinusoidal Fidelity, глава 5.3](https://www.dspguide.com/ch5/3.htm) — масштабирование, сложение, сохранение частоты синусоиды при линейной обработке.
- [Julius O. Smith III. Sinusoids at the Same Frequency](https://www.dsprelated.com/freebooks/mdft/Sinusoids_Same_Frequency.html) — представление суммы через синус и косинус; использована авторская версия на DSPRelated, страница Stanford недоступна.
- [OpenStax. Precalculus 2e, §7.2](https://openstax.org/books/precalculus-2e/pages/7-2-sum-and-difference-identities) — формула синуса суммы углов для вычисления амплитуды.
- [JUCE 9.0.3. AudioSampleBuffer](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_basics/buffers/juce_AudioSampleBuffer.h) — локальные исходники `clear`, `addFrom`, `applyGain`, условия размеров и отсутствие ограничения до ±1.

- [Julius O. Smith III. Clipping Nonlinearity](https://www.dsprelated.com/freebooks/pasp/Clipping_Nonlinearity.html) — прочитаны определение жёсткого ограничения и объяснение необратимости.

## Осцилляторы синтезатора

Прочитаны при подготовке `/synth-oscillators/` по [issue #15](https://github.com/hazadus/audio-theory/issues/15):

- [Vesa Välimäki, Jussi Pekonen, Juhan Nam. Perceptually informed synthesis of bandlimited classical waveforms using integrated polynomial interpolation. JASA 131(1), 2012](https://doi.org/10.1121/1.3651227) — локальная копия в [каталоге](books.md#синтез). Прочитаны разд. I–III, табл. I–III и разд. IV.A–B с табл. VIII: BLEP-остаток, двухточечная поправка из интеграла линейной интерполяции, условия применения, граница слышимости алиасинга 2,1 кГц для двухточечного и 7,8 кГц для четырёхточечного B-сплайна при 44,1 кГц, замена излома треугольника.
- Vesa Välimäki, Antti Huovilainen. Antialiasing Oscillators in Subtractive Synthesis. IEEE Signal Processing Magazine 24(2), 2007 — первоисточник двухточечного PolyBLEP; полный текст за платным доступом не прочитан, метод сверен по изложению в статье 2012 года.
- [Miller Puckette. The Theory and Technique of Electronic Music, гл. 10](http://msp.ucsd.edu/techniques/latest/book-html/node184.html) — прочитаны Fourier series of the elementary waveforms, Sawtooth wave, Square and symmetric triangle waves, Predicting and controlling foldover, Transition splicing: ряды Фурье пилы, прямоугольника и треугольника, отражения около −32 дБ для пилы 440 Гц при 44,1 кГц, невозможность убрать их фильтром, вставка ступеньки с ограниченной полосой.
- [Roland. SH-101 PLUG-OUT Owner’s Manual, 2017](https://www.rolandcloud.com/getmedia/1e415fd4-c8ca-4719-80ba-ca90b94f98ce/SH-101-Manual-E.pdf?ext=.pdf) — цепочка VCO, микшер источников с саб-осциллятором и шумом, VCF, VCA, огибающая; саб на одну или две октавы ниже.
- [JUCE 9.0.3. juce_MidiMessage.cpp](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_basics/midi/juce_MidiMessage.cpp) — `getMidiNoteInHertz`: $440\cdot2^{(m-69)/12}$ с параметром частоты A. [juce_Oscillator.h](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_dsp/widgets/juce_Oscillator.h) — функция формы получает только фазу, частота сглаживается внутри блока.
- [Carl R. Nave. HyperPhysics, Cents](https://hyperphysics.gsu.edu/hbase/Music/cents.html) и [Beats](https://hyperphysics.gsu.edu/hbase/Sound/beat.html) — цент как сотая доля темперированного полутона, частота биений как модуль разности частот.
- [OpenStax. Precalculus 2e, §7.4: Sum-to-Product and Product-to-Sum Formulas](https://openstax.org/books/precalculus-2e/pages/7-4-sum-to-product-and-product-to-sum-formulas) — сумма синусов как произведение для объяснения биений.

## Белый и розовый шум

Прочитаны при подготовке `/noise/`:

- [Steven W. Smith. Глава 2.2: Mean and Standard Deviation](https://www.dspguide.com/ch2/2.htm), [2.3: Signal vs. Underlying Process](https://www.dspguide.com/ch2/3.htm), [2.4: Histogram, Pmf and Pdf](https://www.dspguide.com/ch2/4.htm) и [2.6: Digital Noise Generation](https://www.dspguide.com/ch2/6.htm) — среднее и DC, измеренный фрагмент и модель, распределения, равномерный шум, PRNG и seed. В статистическом разделе различать деление на N−1 при оценке дисперсии и на N при измерении среднего квадрата фрагмента.
- [JUCE 9.0.3. juce_Random.cpp](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_core/maths/juce_Random.cpp) и [Random](https://docs.juce.com/master/classjuce_1_1Random.html) — локальный исходник точного релиза: 48-битный LCG, seed, `nextFloat`, ограничение верхней границы и `getSeed` как текущее состояние.
- [Robin Whittle. DSP Generation of Pink Noise](https://www.firstpr.com.au/dsp/pink-noise/) — характеристики белого и розового шума, сообщения James McCartney 1999 года, выбор ряда по нулям справа, дополнительный белый компонент, ограничения полосы и анализ Allan Herriman. Учебный код собственный, исторические листинги не копируются.
- [Рабочий текст стандарта C++. Counting functions](https://eel.is/c++draft/bit.count) — `std::countr_zero` и случай нулевого аргумента.
- [SciPy. Welch](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.welch.html) — перекрывающиеся сегменты, Hann, усреднение периодограмм, единицы PSD, одностороннее нормирование.
- [Julius O. Smith III. Spectral Audio Signal Processing, Welch's Method](https://www.dsprelated.com/freebooks/sasp/Welch_s_Method.html) — прочитаны разбиение на блоки, усреднение периодограмм и компромисс между разрешением и разбросом оценки.
- [Ross Bencina. Real-time audio programming 101: time waits for nothing](http://www.rossbencina.com/code/real-time-audio-programming-101-time-waits-for-nothing) — прочитаны причины задержек аудиопотока: мьютексы, выделение памяти в `push_back`, обращения к диску и другие блокирующие операции.
- [Robert A. Wannamaker, Stanley P. Lipshitz, John Vanderkooy, J. Nelson Wright. A Theory of Non-Subtractive Dither, IEEE Transactions on Signal Processing 48(2), 2000, с. 499–516](https://www.researchgate.net/publication/3317523_A_theory_of_nonsubtractive_dither) — авторская копия, Practical Dither Signals: сумма двух равномерных распределений, TPDF с размахом два LSB, независимость первого и второго моментов полной ошибки и ограничения полной статистической независимости. Ссылка проверена по [списку публикаций автора](https://robertwannamaker.com/writings.html); прежний PDF на его сайте недоступен.

- [Barbara Illowsky, Susan Dean. OpenStax, Introductory Statistics 2e, §4.2: Mean or Expected Value and Standard Deviation](https://openstax.org/books/introductory-statistics-2e/pages/4-2-mean-or-expected-value-and-standard-deviation) — прочитано объяснение вероятности на длинной серии опытов, формула математического ожидания дискретного распределения и примеры.

- [Julius O. Smith III. Spectral Audio Signal Processing, White Noise](https://www.dsprelated.com/freebooks/sasp/White_Noise.html) — прочитаны определение белого шума через некоррелированность, отличие от распределения амплитуд и усреднение спектральных оценок.
- [OpenStax. Introductory Statistics 2e, §3.2: Independent and Mutually Exclusive Events](https://openstax.org/books/introductory-statistics-2e/pages/3-2-independent-and-mutually-exclusive-events) — прочитаны определение независимости и примеры повторных испытаний.

## Нормы громкости вещания

- [Приказ Минкомсвязи России от 21.05.2015 № 171 «Об утверждении Рекомендаций в области нормирования звуковых сигналов в телерадиовещании»](https://www.garant.ru/products/ipo/prime/doc/70951794/) — текст рекомендаций прочитан при подготовке статьи о лимитере: п. 1.3 (применяются вещателями добровольно), п. 1.4 (основа — EBU R 128-2011), п. 1.6 (определения громкости, диапазона громкости и истинного пика в dBTP), п. 3.2 (громкость программы −23,0 LUFS), п. 3.7–3.8 (истинный пик не выше −1 dBTP в тракте формирования программы, для программ короче 30 с −3 dBTP, рекомендуемые пределы кратковременной громкости). Значения допусков в п. 3.2 на странице garant.ru выведены изображениями и при чтении текста не видны; перед ссылкой на них открыть страницу в браузере. Темы: LUFS, нормализация громкости, истинный пик.
- [EBU R 128-2023. Loudness normalisation and permitted maximum level of audio signals](https://tech.ebu.ch/docs/r/r128.pdf) — локальная копия в [каталоге](books.md#стандарты-громкости-и-пиков). Прочитаны пункты g–m: громкость программы −23,0 LUFS, допуск ±1,0 LU для прямого эфира, измерение по BS.1770 и EBU Tech 3341, истинный пик не выше −1 dBTP при производстве с допуском ±0,3 дБ и более низкие пределы для систем распространения с кодированием с потерями; определения Programme Loudness, Loudness Range, Maximum True Peak Level. Темы: LUFS, истинный пик, нормы вещания.
- [ITU-R BS.1770-5 (11/2023). Algorithms to measure audio programme loudness and true-peak audio level](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.1770-5-202311-I!!PDF-E.pdf) — локальная копия в [каталоге](books.md#стандарты-громкости-и-пиков). Прочитано прил. 2 с дополнением 1: истинный пик как наибольшее значение в непрерывном времени, четырёхкратная передискретизация при 48 кГц и двукратная при 96 кГц, коэффициенты интерполирующего КИХ-фильтра, единица dB TP; ошибки пиковых измерителей по отсчётам, недооценка 3 дБ для тона fs/4, формула $20\lg\cos(\pi f_\text{norm}/n)$ и таблица наибольшей недооценки. При подготовке раздела о LUFS в статье об уровне сигнала (issue #20) прочитано прил. 1 с дополнением 1: взвешивание K из полочного фильтра и фильтра RLB, коэффициенты для 48 кГц, формула громкости с весами каналов и постоянной −0,691, блоки 400 мс с перекрытием 75 %, пороги −70 LKFS и −10 LU, −3,01 LKFS для тона 997 Гц в одном канале, неприменимость к чистым тонам, сравнение Leq(RLB) с оценками слушателей. Темы: истинный пик, пиковые измерители, передискретизация, LUFS, взвешивание K, стробирование.
- [EBU Tech 3341-2023. Loudness Metering: ‘EBU Mode’ metering to supplement EBU R 128 loudness normalization](https://tech.ebu.ch/docs/tech/tech3341.pdf) — локальная копия в [каталоге](books.md#стандарты-громкости-и-пиков). Прочитаны разд. 2.1–2.9 и табл. 1: шкалы M, S, I, окна 0,4 и 3 с без стробирования, частота обновления, единицы LUFS и LU, шкалы EBU +9 и +18, обязательный набор показаний, проверка стереосинусоидой −18 dBFS, проверочные сигналы. Темы: измеритель громкости, LUFS, LU.
- [EBU Tech 3342-2023. Loudness Range: a measure to supplement EBU R 128 loudness normalization](https://tech.ebu.ch/docs/tech/tech3342.pdf) — локальная копия в [каталоге](books.md#стандарты-громкости-и-пиков). Прочитаны разд. 2–5: определение LRA, окно 3 с, пороги −70 LUFS и −20 LU, 10-й и 95-й процентили, отличие от динамического диапазона и пик-фактора, проверочные сигналы, реализация на MATLAB. Темы: диапазон громкости.
- [EBU Tech 3205-E. The EBU standard peak-programme meter for the control of international transmissions, 2nd ed., 1979](https://tech.ebu.ch/docs/tech/tech3205.pdf) — локальная копия в [каталоге](books.md#стандарты-громкости-и-пиков). Исторический документ, заменён R 128. Прочитаны «General» и разд. 3: квазипиковое показание, время интеграции 10 мс и его определение по пачке 5 кГц, возврат с +12 до −12 за 2,8 с, тип IIb по IEC 268-10. Темы: PPM, измерители уровня.
- Roey Izhaki. Mixing Audio: Concepts, Practices and Tools, 2nd ed., Focal Press, 2012 — прочитана гл. 8, с. 93–98: уровень как модуль сигнала, пиковые измерители, удержание пика и индикатор перегрузки, усредняющие измерители, VU-метр и его шкала от −20 до +3. Темы: измерители уровня.
- [Приказ Минкомсвязи № 171, повторное чтение для статьи о нормах громкости (issue #24)](https://www.garant.ru/products/ipo/prime/doc/70951794/) — страница Гаранта в кодировке windows-1251; допуски п. 3.2 и числа п. 3.8 для коротких программ: п. 3.8 прочитан текстом, допуски п. 3.2 остаются рисунками (`pict211…212`), которые с сервера не скачались. Страница Минцифры (digital.gov.ru/ru/documents/4635/) из этой среды не открылась: допуски сверить в браузере.
- [EBU Tech 3343-2023. Guidelines for Production of Programmes in accordance with EBU R 128](https://tech.ebu.ch/docs/tech/tech3343.pdf) — локальная копия в [каталоге](books.md#стандарты-громкости-и-пиков). Прочитаны п. 2.1 (нормализация по пику и по громкости), п. 3.1 (допуски ±0,2 и ±1,0 LU), п. 9.1–9.2 (параметры R 128 s1 для коротких форм, потоковая доставка). Темы: нормы вещания, реклама, стриминг.
- [ATSC A/85:2013. Techniques for Establishing and Maintaining Audio Loudness for Digital Television](https://www.atsc.org/wp-content/uploads/2021/04/A85-2013.pdf) — локальная копия в [каталоге](books.md#стандарты-громкости-и-пиков). Прочитаны определения (опорный элемент, Dialog Level), разд. 6 и прил. I.7: цель −24 LKFS для материала без метаданных, отклонения около ±2 дБ, истинный пик ниже −2 dB TP; разд. 7.1 о dialnorm. Темы: нормы вещания США, LKFS.
- [47 CFR 73.682(e) и 73.8000(a)(4)](https://www.law.cornell.edu/cfr/text/47/73.682) — копия Legal Information Institute: обязательное соблюдение ATSC A/85 в части рекламы с 13.12.2012, редакция A/85:2013. Темы: закон CALM.
- [FCC 25-16, NPRM по закону CALM, Federal Register 11.03.2025](https://www.govinfo.gov/content/pkg/FR-2025-03-11/html/2025-03800.htm) — закон Public Law 111-311, правила 2012 и 2014 годов, сравнение средней громкости рекламы и программы, вопрос о пересмотре. Прочитан полностью до п. 5.
- [Spotify for Artists. Loudness normalization on Spotify](https://support.spotify.com/us/artists/article/loudness-normalization/) — прочитана 6 октября 2026 года: цель −14 LUFS, режимы Loud/Normal/Quiet, запас 1 dB при подъёме, лимитер режима Loud, рекомендации для мастера. Числа площадок меняются: при повторном использовании перечитать.
- [Apple Podcasts for Creators. Audio requirements](https://podcasters.apple.com/support/893-audio-requirements) — прочитана 6 октября 2026 года: −16 LKFS ±1 dB, истинный пик не выше −1 dB FS, измерение по BS.1770-5, метаданные громкости и Sound Check.
- [Apple Digital Masters (2021)](https://www.apple.com/apple-music/apple-digital-masters/docs/apple-digital-masters.pdf) — прочитаны разделы о громкости, запасе и Sound Check (числа цели нет).
- [YouTube Help. Control video volume on your device](https://support.google.com/youtube/answer/14106294) — прочитана 6 октября 2026 года: стабильная громкость; целевых значений на странице нет, неофициальные сводки о −14 LUFS не использованы.
- [AES TD1004.1.15-10. Recommendation for Loudness of Audio Streaming and Network File Playback](https://aes.org/wp-content/uploads/2024/01/AESTD1004_1_15_10.pdf) — локальная копия в [каталоге](books.md#стандарты-громкости-и-пиков). Прочитаны п. 3 и разд. 6: цель не выше −16 и не ниже −20 LUFS, короткие формы, предел −1,0 dB TP, алгоритмы нормализации. Последующую AES77-2023 (AES, июль 2023; платная) подтвердил только список литературы TD1009, текст не читался; страницы aes.org/publications из этой среды отдают 403.
- [Wikipedia. VU meter](https://en.wikipedia.org/wiki/VU_meter) и [Peak programme meter](https://en.wikipedia.org/wiki/Peak_programme_meter) — время нарастания VU-метра 300 мс до 99 %, стандарты ANSI C16.5 и IEC 60268-17; квазипиковые и выборочные PPM, время интеграции 5 мс (тип I) и 10 мс (тип II) по IEC 60268-10. Сами стандарты IEC платные и не читались. Темы: измерители уровня.

## Лимитер

- Roey Izhaki. Mixing Audio, 2nd ed., Focal Press, 2012 — прочитаны гл. 15, с. 264–265 (характеристика лимитера, накачка и «дыхание»); гл. 16, с. 279 (автоматические атака и восстановление), с. 294 (сжатие 10:1 и ∞:1 по сравнению с лимитером), с. 301–303 (искажение низких частот при коротких атаке и восстановлении, удержание около периода 50 Гц, накачка при коротком восстановлении, очень длинное восстановление как постоянное ослабление); гл. 17, с. 331–333 (пиковый детектор, жёсткое колено и нулевая атака, мягкое колено и предварительный анализ, две ступени, потолок и запас 0,2 дБ на ЦАП, применение, громкость как помеха сравнению).
- Mike Senior. Mixing Secrets for the Small Studio, Focal Press, 2011 — прочитаны гл. 9, с. 153 (лимитер как компрессор с высоким сжатием и входным усилением), гл. 10, с. 167 (предварительный анализ на несколько миллисекунд, задержка плагина и гребенчатая фильтрация при параллельной обработке), гл. 19, с. 279 (побочные эффекты ограничения всей суммы).
- [Geraint Luff. Designing a straightforward limiter. Signalsmith Audio, 2022](https://signalsmith-audio.co.uk/writing/2022/limiter/) — прочитана целиком: мгновенное усиление как клиппер, скользящий минимум и конечное сглаживание с задержкой, восстановление перед сглаживанием, удержание, первая ступень с IIR-сглаживанием и клиппер после неё, пики между отсчётами и передискретизация в детекторе.
- [Julius O. Smith III. Physical Audio Signal Processing: Soft Clipping](https://ccrma.stanford.edu/~jos/pasp/Soft_Clipping.html) — кубический мягкий клиппер $x - x^3/3$ с пределами ±2/3.
- [Wikipedia. Dynamic range compression](https://en.wikipedia.org/wiki/Dynamic_range_compression) — прочитаны разделы Look-ahead (две ветви и цена в виде задержки), Limiting (лимитер и клиппер, brick wall), Serial compression (компрессор и пиковый лимитер друг за другом), Attack and release (автоматическое восстановление).

## Программные компрессоры и лимитеры

Руководства производителей к разделам «Примеры приборов» (issue #21). Описывают органы управления и режимы, но не алгоритмы; маркетинговые оценки звучания в статьи не переносить.

- [Apple. Logic Pro User Guide: Compressor main parameters](https://support.apple.com/guide/logicpro/compressor-main-parameters-lgcead9636ef/mac) — прочитаны: семь моделей Circuit Type (Platinum Digital, Studio VCA и FET, Classic VCA, Vintage VCA, FET и Opto), Knee, Auto Release, Auto Gain. Страница отдаёт текст только при загрузке с заголовком браузера.
- [Apple. Logic Pro User Guide: Adaptive Limiter](https://support.apple.com/guide/logicpro/adaptive-limiter-controls-lgcef1becbb8/mac) — прочитаны: Gain, Out Ceiling, Lookahead с задержкой, Optimal Lookahead, True Peak Detection, Remove DC Offset.
- [Ableton. Live 12 Reference Manual: Live Audio Effect Reference](https://www.ableton.com/en/manual/live-audio-effect-reference/) — прочитаны разделы Compressor (Peak, RMS, Expand над порогом, предварительный анализ 0, 1 и 10 мс, Lin/Log, внешний вход и эквалайзер боковой цепи) и Limiter (Ceiling, Maximize, Release и Auto, предварительный анализ 1,5, 3 и 6 мс, режимы Standard, Soft Clip, True Peak).
- [Cockos. ReaPlugs](https://www.reaper.fm/reaplugs/) — бесплатный набор модулей REAPER; список возможностей ReaComp: мягкое колено, длина окна RMS, режим обратной связи, автоматическое восстановление, предварительный анализ, фильтры и вход боковой цепи.
- [FabFilter. Pro-C 3](https://www.fabfilter.com/products/pro-c-3-compressor-plug-in) — страница продукта (старый адрес Pro-C 2 перенаправляет сюда): 14 стилей, колено до 72 дБ, предварительный анализ до 20 мс, удержание до 500 мс, до шести полос эквалайзера боковой цепи.
- [FabFilter. Pro-L 2 Help: Advanced settings](https://www.fabfilter.com/help/pro-l/using/advancedsettings) и [Input and output options](https://www.fabfilter.com/help/pro-l/using/outputoptions) — прочитаны: восемь алгоритмов, быстрая ступень с предварительным анализом и медленная ступень Attack/Release, анализ короче 0,1 мс как приближение к жёсткому клиппингу, ограничение истинного пика, рекомендации по потолку в dBTP.
- Universal Audio. UAD Powered Plug-Ins Manual, software version 6.1, 2011 ([PDF](https://media.uaudio.com/support/downloads/UADManual_61.pdf)) — прочитана гл. 25, с. 283–287: органы управления моделей LA-2A (Peak Reduction, Gain, Compress/Limit, фильтр предыскажений в боковой цепи) и 1176LN (Input как порог, атака 20–800 мкс, восстановление 50–1100 мс, кнопки 4:1–20:1 и режим всех кнопок, схема с обратной связью). Современные руководства на help.uaudio.com при подготовке не открывались (сайт не отвечал), страницы продуктов отдавали 429.
- [Tokyo Dawn Labs. Limiter 6 GE Manual](https://docs.tokyodawn.net/limiter-6-ge-manual/) — прочитаны концепция, порядок модулей по скорости, модуль Peak Limiter (Recovery, Ahead), модуль Output (защитный лимитер, потолок PCM и True Peak).
- [LoudMax](https://loudmax.blogspot.com/) — страница бесплатного лимитера: два регулятора, предварительный анализ и атака 1,25 мс, автоматическое восстановление, режим ISP с дополнительной задержкой 6 отсчётов.

## Музыкальная теория — Open Music Theory и Ableton

Для вводного обзора «Теория музыки: ноты, ритм и гармония» прочитаны:

- [Chelsey Hamm. Half Steps, Whole Steps, and Accidentals](https://viva.pressbooks.pub/openmusictheory/chapter/half-and-whole-steps/) — соседние клавиши, диезы, бемоли, энгармоническое равенство.
- [Mark Gotham, Chelsey Hamm, Bryn Hughes. Notating Rhythm](https://viva.pressbooks.pub/openmusictheory/chapter/notating-rhythm/) — относительные длительности нот и пауз.
- [Chelsey Hamm. Triads](https://viva.pressbooks.pub/openmusictheory/chapter/triads/) — четыре типа трезвучий, основной тон, терция и квинта, буквенные обозначения.
- [Samuel Brady, Chelsey Hamm, Megan Lavengood, Kris Shaffer. Roman Numerals](https://viva.pressbooks.pub/openmusictheory/chapter/roman-numerals/) — ступени и типы аккордов, перенос между тональностями.
- [Chelsey Hamm, Bryn Hughes. Major Scales, Scale Degrees, and Key Signatures](https://viva.pressbooks.pub/openmusictheory/chapter/major-scales/) — шаги мажора, ключевые знаки и круг.
- [Ableton Learning Music: Beat and tempo](https://learningmusic.ableton.com/make-beats/beat-and-tempo.html), [Bars](https://learningmusic.ableton.com/make-beats/bars.html), [Keys and scales](https://learningmusic.ableton.com/notes-and-scales/keys-and-scales.html), [Major triads](https://learningmusic.ableton.com/chords/major-triads.html), [1-5-6-4](https://learningmusic.ableton.com/chords/1-5-6-4.html) — темп, группировка долей, тоника и первые аккорды.
- [Ableton Live 12 Manual: Arpeggiator](https://www.ableton.com/en/live-manual/12/live-midi-effect-reference/#arpeggiator) — порядок и скорость исполнения нот аккорда, направления и синхронизация с темпом.

[SANDYNE Learn](https://sandyne.com/learn#pitch) прочитан как ориентир музыкальных опытов. Универсальные утверждения о настроении, правильных нотах и натуральных квинтах из него не переносить; для темперации используется также [HyperPhysics: Cents](https://hyperphysics.gsu.edu/hbase/Music/cents.html).

Для музыкального обзора также проверены Hutchinson §1.3 (C4 и смена номера на C) и §4.4 (метр, простой и составной размер). [Open Music Theory: Minor Scales](https://viva.pressbooks.pub/openmusictheory/chapter/minor-scales/) — прочитан раздел The Parallel and Relative Relationships: общая тоника и общий набор ключевых знаков.

## DAW — руководства и страницы программ

Для вводного обзора «Первое знакомство с DAW» прочитаны:

- [Cockos. REAPER](https://www.reaper.fm/) и [Purchase](https://www.reaper.fm/purchase.php) — назначение, платформы Windows, macOS и Linux, 60 дней полной ознакомительной версии, лицензии 60 и 225 долларов и условия скидочной лицензии. REAPER не бесплатен.
- [Apple. GarageBand для Mac](https://www.apple.com/mac/garageband/) и [Mac App Store](https://apps.apple.com/us/app/garageband/id682658836?mt=12) — платформы, возможности и бесплатное распространение.
- [LMMS](https://lmms.io/) — бесплатная программа с открытым кодом, платформы, piano roll, встроенные синтезаторы и эффекты; сведений о записи аудио на главной странице нет.
- [MIDI Association. Summary of MIDI 1.0 Messages](https://midi.org/summary-of-midi-1-0-messages) — Note On и Note Off, номер ноты и сила нажатия 0–127, Note On с силой 0.
- [Ableton Live 12 Manual](https://www.ableton.com/en/live-manual/12/): Editing MIDI (содержимое MIDI-клипа, редактор нот), Mixing (Track Activator, Solo и Exclusive Solo, Arm, Volume и Pan, Main), Routing and I/O (мониторинг In, Auto, Off, задержка), Automation and Editing Envelopes (автоматизация, ручная отмена), Audio Clips, Tempo, and Warping (режимы Beats, Tones, Texture, Re-Pitch, Complex), Converting Audio to MIDI (условия точности), Managing Files and Sets (экспорт, ссылки клипов на файлы).
- [W3C. Web Audio API: StereoPannerNode](https://www.w3.org/TR/webaudio/#stereopanner-algorithm) — равномощная панорама для моно.

[SANDYNE Learn](https://sandyne.com/learn#track-controls) просмотрен как ориентир компоновки опытов DAW (шапка дорожки, piano roll, сравнение клипов, цепочка); технические утверждения проверены по руководствам выше.

## Пространственная обработка: панорама, delay, reverb и M/S

Для статьи `/spatial-audio/` прочитаны:

- Roey Izhaki. Mixing Audio: Concepts, Practices and Tools, 2nd ed., Focal Press, 2012 — гл. 9, с. 108–113: посылы до и после фейдера и возвраты; гл. 13, с. 180–194: панорама, законы панорамирования, баланс стерео; гл. 21, с. 377–386: линия задержки, feedback, wet/dry и зависимость слышимого результата от времени; гл. 23, с. 411–430: алгоритмическая и свёрточная реверберация, предзадержка, ранние отражения, хвост, глубина, RT60, диффузия и damping; гл. 26, с. 461–464: нормировка полусуммы/полуразности, обратное преобразование и отдельная обработка M/S. Локальный PDF описан в [каталоге](books.md#сведение-концепции-и-практика); формулы M/S сверены по странице 462 оригинала.
- [Ableton. Live 12 Reference Manual: Reverb](https://www.ableton.com/en/live-manual/12/live-audio-effect-reference/#reverb) — прочитаны Early Reflections, Diffusion Network и Global Settings: Predelay до первых отражений, Decay как спад хвоста на 60 дБ, фильтры внутри сети. Описывает конкретный прибор.
- [DPA Microphones. MS Recording](https://www.dpamicrophones.com/dictionary/m/ms-recording/) — прочитано определение микрофонной техники и декодирование с нормировкой через квадратный корень из двух. Темы: альтернативная нормировка M/S и согласование преобразований.
- [ITU-R BS.775-3, 2012](https://www.itu.int/dms_pubrec/itu-r/rec/bs/R-REC-BS.775-3-201208-S!!PDF-E.pdf) — прочитаны рекомендации по пяти основным каналам, прил. 1 и прил. 7 с дополнением 1: LFE, ограниченная полоса, отличие от сабвуфера и перенаправление баса. Локальный PDF — в [каталоге](books.md#многоканальный-звук-и-lfe). Темы: 5.1, назначение каналов и bass management.

## Плагины: dry/wet, bypass и компенсация задержки

Для статьи `/dry-wet-bypass/` по [issue #32](https://github.com/hazadus/audio-theory/issues/32) прочитаны:

- [Steinberg. VST 3 Developer Portal, FAQ: Processing](https://steinbergmedia.github.io/vst3_dev_portal/pages/FAQ/Processing.html) — вопрос How does Audio Processing Bypass work?: параметр с флагом `kIsBypass`, хост продолжает вызывать `process`, плагин сам отвечает за переключение без артефактов и задержанную копию входа, точное по отсчёту или поблочное переключение (не рекомендуется при блоках длиннее 1024), сохранение параметра в состоянии.
- [CLAP 1.2.10. params.h](https://github.com/free-audio/clap/blob/1.2.10/include/clap/ext/params.h) — флаг `CLAP_PARAM_IS_BYPASS`: объединение кнопок обхода хоста и плагина, не более одного такого параметра, значение не влияет на вызов `process()`.
- [Ableton. Live 12 Reference Manual: Working with Instruments and Effects](https://www.ableton.com/en/live-manual/12/working-with-instruments-and-effects/) — разделы 23.2.1 Device Title Bar (Activator: выключенное устройство как временно удалённое, без нагрузки на процессор) и 23.3 Device Delay Compensation (автоматическая компенсация задержки устройств и плагинов, включая возвраты; Reduced Latency When Monitoring).
- [Ableton. Live 12 Reference Manual: Audio Fact Sheet](https://www.ableton.com/en/live-manual/12/audio-fact-sheet/) — раздел 39.2.8 Bypassed Effects: выключенный эффект убран из пути сигнала, но задержка, требуемая параметрами (Lookahead), сохраняется ради компенсации.
- JUCE 9.0.3: [AudioProcessor.h](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_processors_headless/processors/juce_AudioProcessor.h) и [AudioProcessor.cpp](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_processors_headless/processors/juce_AudioProcessor.cpp) — `getBypassParameter`, `processBlockBypassed` с проверкой нулевой задержки по умолчанию, `setLatencySamples`; [обёртка VST3](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_plugin_client/juce_audio_plugin_client_VST3.cpp) — собственный параметр Bypass при `nullptr`, флаг `kIsBypass`, вызов `processBlockBypassed`; [DryWetMixer](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_dsp/processors/juce_DryWetMixer.cpp) — семь законов смешивания, задержка dry линией Тирана, линейный переход 50 мс; [SmoothedValue](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_basics/utilities/juce_SmoothedValue.h) — `reset`, `setTargetValue`, `getNextValue`.
- [Geraint Luff. A cheap energy-preserving-ish crossfade. Signalsmith Audio, 2021](https://signalsmith-audio.co.uk/writing/2021/cheap-energy-crossfade/) — выбор между постоянной суммой амплитуд (коррелированные сигналы, ограничение пиков) и постоянной энергией (некоррелированные), провал RMS в середине линейного перехода, гладкие края против щелчков.
- Roey Izhaki. Mixing Audio, 2nd ed., гл. 23, с. 418 — dry/wet ревербератора во вставке и при подключении через посыл.

## C++: владение объектами и умные указатели

Для статьи `/cpp-ownership/` прочитаны:

- Alex. Learn C++: [12.3 Lvalue references](https://www.learncpp.com/cpp-tutorial/lvalue-references/), [12.7 Introduction to pointers](https://www.learncpp.com/cpp-tutorial/introduction-to-pointers/), [14.10 Constructor member initializer lists](https://www.learncpp.com/cpp-tutorial/constructor-member-initializer-lists/) (порядок инициализации полей), [19.1 Dynamic memory allocation with new and delete](https://www.learncpp.com/cpp-tutorial/dynamic-memory-allocation-with-new-and-delete/), [19.3 Destructors](https://www.learncpp.com/cpp-tutorial/destructors/), [20.2 The stack and the heap](https://www.learncpp.com/cpp-tutorial/the-stack-and-the-heap/), [24.3 Order of construction of derived classes](https://www.learncpp.com/cpp-tutorial/order-of-construction-of-derived-classes/), [25.1](https://www.learncpp.com/cpp-tutorial/pointers-and-references-to-the-base-class-of-derived-objects/) и [25.4](https://www.learncpp.com/cpp-tutorial/virtual-destructors-virtual-assignment-and-overriding-virtualization/) (указатель на базу, виртуальный деструктор), глава 22 — [22.1](https://www.learncpp.com/cpp-tutorial/introduction-to-smart-pointers-move-semantics/), [22.3](https://www.learncpp.com/cpp-tutorial/move-constructors-and-move-assignment/), [22.4 std::move](https://www.learncpp.com/cpp-tutorial/stdmove/), [22.5 std::unique_ptr](https://www.learncpp.com/cpp-tutorial/stdunique_ptr/) (раздел std::make_unique и проблема порядка вычисления аргументов, исправленная в C++17), [22.6 std::shared_ptr](https://www.learncpp.com/cpp-tutorial/stdshared_ptr/).
- [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) — I.11 (не передавать владение сырым указателем или ссылкой), R.1 (RAII), R.3 (сырой указатель не владеет), R.11 (избегать явных `new`/`delete`), R.20, R.23 (`make_unique`, безопасность при исключениях только до C++17). Названия правил сверены по исходному Markdown репозитория isocpp/CppCoreGuidelines.
- cppreference: [std::make_unique](https://en.cppreference.com/w/cpp/memory/unique_ptr/make_unique) (C++14, `make_unique_for_overwrite` в C++20, constexpr с C++23), [Destructors](https://en.cppreference.com/w/cpp/language/destructor) (раздел Destruction sequence), [Storage duration](https://en.cppreference.com/w/cpp/language/storage_duration).
- [tremolo-juce-course](https://github.com/juce-framework/tremolo-juce-course), папка `complete` (JUCE 8.0.12) и 9.0.3: `AudioProcessor::addParameter` (оборачивает указатель в `std::unique_ptr` и кладёт в `parameterTree`), `addParameterGroup`, документация `createEditor` (редактор удаляется раньше процессора, процессор не хранит указатель на него), [juce_CreatePluginFilter.h](https://github.com/juce-framework/JUCE/blob/9.0.3/modules/juce_audio_plugin_client/detail/juce_CreatePluginFilter.h) (`createPluginFilterOfType` и `rawToUniquePtr`), обёртки VST3/AAX/LV2 (`pluginEditor.reset (createEditorIfNeeded())`), конструкторы `AudioProcessorParameterGroup` и `AudioProcessorValueTreeState::ParameterLayout` с `std::unique_ptr`, макросы `JUCE_DECLARE_NON_COPYABLE` и `JUCE_DECLARE_NON_MOVEABLE` в `juce_PlatformDefs.h`.

Для статьи `/cpp-audio-thread/` прочитаны:

- [Ross Bencina. Real-time audio programming 101: time waits for nothing, 2011](http://www.rossbencina.com/code/real-time-audio-programming-101-time-waits-for-nothing) — раздел Memory allocation: три причины не выделять память в колбэке (блокировка аллокатора, запрос памяти у ОС и подкачка страниц, непредсказуемый алгоритм), предварительное выделение; инверсия приоритетов.
- [Timur Doumler. Using locks in real-time audio processing, safely, 2020](https://web.archive.org/web/20250113204348/https://timur.audio/using-locks-in-real-time-audio-processing-safely) (копия Internet Archive, сайт отвечал 500) — `std::atomic` для чисел, SPSC-очередь для потока объектов, неизменяемые структуры, почему `std::mutex::try_lock` небезопасен (`unlock` и системный вызов), спинлок; ссылки на CppCon 2015 и Real-time 101 (Rowland, Renn-Giles).
- [Форум JUCE, тред «Timur Doumler Talks on C++ Audio (Sharing data across threads)»](https://forum.juce.com/t/timur-doumler-talks-on-c-audio-sharing-data-across-threads/26311), сообщение Doumler от 12.03.2019 (#26) — отказ от схемы `shared_ptr` + ReleasePool из CppCon 2015.
- [LLVM. RealtimeSanitizer](https://clang.llvm.org/docs/RealtimeSanitizer.html), [Clang 20.1.0 Release Notes](https://releases.llvm.org/20.1.0/tools/clang/docs/ReleaseNotes.html), `compiler-rt/cmake/config-ix.cmake` (Darwin и Linux) — флаг, атрибуты, `RTSAN_OPTIONS`, версия и платформы. Проверено Homebrew Clang 22.1; Apple Clang 17 флаг не принимает.
- [cppreference. std::atomic&lt;std::shared_ptr&gt;](https://en.cppreference.com/w/cpp/memory/shared_ptr/atomic2); libstdc++ 14 `bits/shared_ptr_atomic.h` и Microsoft STL `inc/memory` (`is_always_lock_free = false`, блокировка на младшем бите); [libc++ C++20 Status](https://libcxx.llvm.org/Status/Cxx20.html) (P0718R2 без статуса, шаблон не компилируется).
- JUCE 8.0.12 и 9.0.3: `AudioProcessor` (`processBlock`, `prepareToPlay`, `releaseResources`), `AudioProcessorParameter::Listener`, `std::atomic<float>` в `AudioParameterFloat/Bool/Choice`, `AbstractFifo`, `AudioBuffer::setSize` (`avoidReallocating`), `OwnedArray`, `WeakReference`, `Component::SafePointer`, `ReferenceCountedObject`, `LeakedObjectDetector`, `JUCE_CHECK_MEMORY_LEAKS`, `dsp::IIR::Coefficients` (`ProcessorState : ReferenceCountedObject`).
- [tremolo-juce-course](https://github.com/juce-framework/tremolo-juce-course), `complete`: `SampleFifo.h`, `LfoVisualizer`, `Tremolo::prepare`, `BypassTransitionSmoother`, примеры `GuiAndAudioThreadIdPrinting` и `LongRunningTask`.

Для статей `/cpp-basics/` и `/cpp-classes/` открыты и сверены:

- Alex. [Learn C++](https://www.learncpp.com/) — оглавление сайта использовано для проверки номеров и адресов уроков; прочитаны [7.14 Unnamed and inline namespaces](https://www.learncpp.com/cpp-tutorial/unnamed-and-inline-namespaces/) (внутренняя связь), [14.10 Constructor member initializer lists](https://www.learncpp.com/cpp-tutorial/constructor-member-initializer-lists/) и [27.9 Exception specifications and noexcept](https://www.learncpp.com/cpp-tutorial/exception-specifications-and-noexcept/) (вызов `std::terminate`). Темы: препроцессор, заголовки, типы, ссылки, указатели, классы, наследование, шаблоны, перегрузка операторов, лямбды.
- cppreference: [nodiscard](https://en.cppreference.com/w/cpp/language/attributes/nodiscard) (C++17), [std::size_t](https://en.cppreference.com/w/cpp/types/size_t) (заголовок `<cstddef>`), [static_cast](https://en.cppreference.com/w/cpp/language/static_cast), [std::span](https://en.cppreference.com/w/cpp/container/span).
- [JUCE. JUCE Module Format](https://github.com/juce-framework/JUCE/blob/master/docs/JUCE%20Module%20Format.md) — один `.cpp` в корне модуля вставляет остальные исходники, чтобы модуль подключался одним файлом; блок `BEGIN_JUCE_MODULE_DECLARATION` и его поля.
- CMake: [UNITY_BUILD](https://cmake.org/cmake/help/latest/prop_tgt/UNITY_BUILD.html) (CMake 3.16, пакеты исходников, исключения, `UNITY_BUILD_UNIQUE_ID` для анонимных пространств имён) и [target_precompile_headers](https://cmake.org/cmake/help/latest/command/target_precompile_headers.html) (CMake 3.16) — альтернативы ручному unity build.
- [cppreference. Modules](https://en.cppreference.com/w/cpp/language/modules) — модули C++20, модули `std` в C++23, отличие `import` от `#include` для макросов.
- [GoogleTest. Primer](https://google.github.io/googletest/primer.html) — `TEST`, `TEST_F`, фикстуры и проверки `EXPECT_*` и `ASSERT_*`.
- JUCE 8.0.12: [juce_PlatformDefs.h](https://github.com/juce-framework/JUCE/blob/8.0.12/modules/juce_core/system/juce_PlatformDefs.h) (`JUCE_CALLTYPE`, `jassert`, `JUCE_DECLARE_NON_COPYABLE*`), [juce_AudioParameterFloat.h](https://github.com/juce-framework/JUCE/blob/8.0.12/modules/juce_audio_processors_headless/utilities/juce_AudioParameterFloat.h) и [juce_AudioParameterBool.h](https://github.com/juce-framework/JUCE/blob/8.0.12/modules/juce_audio_processors_headless/utilities/juce_AudioParameterBool.h) (операторы преобразования параметров).
