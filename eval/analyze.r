# Compare means with Kruskal-Wallis test (nonparametric, because non-normal distribution)

data <- read.csv('bench-times-tests.tsv', sep = '\t')

shapiro.test(data$parser11toAST) # W = 0.67952, p-value < 2.2e-16 => not a normal distr!

# Test means 1.1 vs 1.2 to AST
median(data$parser11toAST) # 5.320914
median(data$parser12toAST) # 5.655544
kruskal.test(list(data$parser11toAST, data$parser12toAST))
# chi-squared = 389.18, df = 1, p-value < 2.2e-16 => statistically different distribution!

# Test means 1.1 vs 1.2 to AST with source tracking
median(data$parser11toASTSRC) # 6.165216
median(data$parser12toASTSRC) # 6.629568
kruskal.test(list(data$parser11toASTSRC, data$parser12toASTSRC))
# chi-squared = 709.85, df = 1, p-value < 2.2e-16 => statistically different distribution!

# Test means 1.1 vs 1.2 to Algebra
median(data$parser11toAlgebra) # 8.474002
median(data$parser12toAlgebra) # 9.210626
kruskal.test(list(data$parser11toAlgebra, data$parser12toAlgebra))
# chi-squared = 837.48, df = 1, p-value < 2.2e-16 => statistically different distribution!

