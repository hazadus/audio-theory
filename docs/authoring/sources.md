# Рекомендуемые источники

Пополняемый список литературы для подготовки и дополнения материалов по [общим правилам](rules.md). Добавлять полезные источники после чтения: автор, название, ссылка и темы применения. Для конкретного утверждения проверять подходящий раздел и ссылаться на него в статье. Рекомендация не делает источник обязательным или единственным.

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

- [compressor](https://www.mathworks.com/help/audio/ref/compressor-system-object.html) — характеристика с жёстким и мягким коленом шириной W вокруг порога, сглаживание подавления с $\alpha = e^{-\ln 9/(f_s t)}$, время атаки и восстановления как переход от 10 до 90 %, автоматическая компенсация.
- [limiter](https://www.mathworks.com/help/audio/ref/limiter-system-object.html) — выход выше порога равен порогу.
- [expander](https://www.mathworks.com/help/audio/ref/expander-system-object.html) — ниже порога $y = T + (x - T) R$.
- [noiseGate](https://www.mathworks.com/help/audio/ref/noisegate-system-object.html) — нулевое усиление ниже порога, время удержания.

## W3C — Web Audio API: DynamicsCompressorNode

[Раздел спецификации](https://webaudio.github.io/web-audio-api/#DynamicsCompressorNode). Параметры компрессора браузера: колено выше порога (от T до T + knee), атака и восстановление как время изменения усиления на 10 дБ, фиксированная задержка 6 мс для взгляда вперёд, автоматическая компенсация. Полезно как пример того, что определения параметров различаются между реализациями.

## Wikipedia — DBFS и «Компрессор аудиосигнала»

[DBFS](https://en.wikipedia.org/wiki/DBFS) — 0 dBFS как наибольший цифровой уровень, соглашение AES17 (RMS синусоиды с полной амплитудой — 0 dBFS, прямоугольной волны — +3 dBFS), около 96 дБ у 16 бит; сам стандарт AES17 не читался. [Компрессор аудиосигнала](https://ru.wikipedia.org/wiki/Компрессор_аудиосигнала) — русские названия параметров (порог, степень сжатия, время атаки) и пример сжатия 2:1.

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
