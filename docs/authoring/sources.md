# Рекомендуемые источники

Пополняемый список литературы для подготовки и дополнения материалов по [общим правилам](rules.md). Добавлять полезные источники после чтения: автор, название, ссылка и темы применения. Для конкретного утверждения проверять подходящий раздел и ссылаться на него в статье. Рекомендация не делает источник обязательным или единственным.

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

## Daniel A. Russell — Acoustics and Vibration Animations

[Wave Motion in Mechanical Medium](https://www.acs.psu.edu/drussell/Demos/waves/wavemotion.html) (Penn State). Анимации продольных и поперечных волн: частицы колеблются около положения равновесия, сжатия и разрежения.
